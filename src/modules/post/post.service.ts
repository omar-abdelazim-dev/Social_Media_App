import {
  type IFile,
  type IPost,
  type PostRepo,
  type UserRepo,
  type IPgginate,
  userRepo,
  postRepo,
  exceptions,
  services,
  enums,
  getPostFilter,
} from "../../common/index.js";
import type { HUser } from "../../database/index.js";
import type { createPostDTO } from "./index.js";
import crypto from "crypto";

export class PostService {
  private readonly postRepo: PostRepo;
  private readonly userRepo: UserRepo;
  private readonly s3Service: services.S3Service;
  private readonly notificationService: services.NotificationService;
  private exceptions = exceptions;
  constructor() {
    this.postRepo = postRepo;
    this.userRepo = userRepo;
    this.s3Service = services.s3Service;
    this.notificationService = services.notificationService;
  }

  async createPost({
    user,
    data,
    files,
  }: {
    user: HUser;
    data: createPostDTO;
    files: IFile[];
  }): Promise<IPost> {
    const userId = user._id;
    const { tags, content, availability } = data;
    const metions: string[] = [];
    const FCMTokens: string[] = [];
    if (tags?.length) {
      const accounts = await this.userRepo.findMany({
        filter: {
          id: {
            $in: tags,
          },
        },
      });
      if (accounts.length !== tags.length)
        throw new this.exceptions.NotFoundException(
          "Fail to find some or all tagged accuont",
        );
      for (const tag of tags) {
        metions.push(tag);
        const fcms = await this.notificationService.getFCMs({
          userId: tag,
        });
        if (fcms.length) FCMTokens.push(...fcms);
      }
    }
    const folderId = crypto.randomBytes(10).toString("hex");
    let attachments: string[] = [];
    if (files.length) {
      attachments = await this.s3Service.uploadAssets({
        folder: `post/${folderId}`,
        files,
        storage: enums.storageEnum.memory,
      });
    }
    const post = await this.postRepo.create({
      data: {
        createdBy: userId,
        content,
        attachments,
        folderId,
        availability,
        tags: metions,
      },
    });
    if (!post) {
      if (attachments.length)
        await this.s3Service.deleteAssets({
          keys: attachments,
        });
      throw new this.exceptions.BadRequestException("Post not created");
    }
    if (FCMTokens.length) {
      await this.notificationService.sendNotifications({
        tokens: FCMTokens,
        title: "New Mention",
        body: `${user.userName || user.firstName} mentioned you in his post`,
      });
    }
    return post;
  }

  async listPosts({
    user,
    page,
    limit,
  }: {
    user: HUser;
    page: number;
    limit: number;
  }): Promise<IPgginate<IPost>> {
    return await this.postRepo.paggination({
      filter: {
        $or: getPostFilter(user),
      },
      page,
      limit,
    });
  }
}

export const postService = new PostService();
