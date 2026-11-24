import { Types } from "mongoose";
import {
  enums,
  exceptions,
  services,
  userRepo,
  type ICachedUser,
  type IFile,
  type UserRepo,
} from "../../common/index.js";
import type { HUser } from "../../database/index.js";

class UserService {
  private readonly userRepo: UserRepo;
  private readonly s3Service: services.S3Service;

  constructor() {
    this.userRepo = userRepo;
    this.s3Service = services.s3Service;
  }

  async searchUsers({
    user,
    query,
    page,
    limit,
  }: {
    user: HUser | ICachedUser;
    query: string;
    page: number;
    limit: number;
  }) {
    const currentUserId = new Types.ObjectId(user._id);
    const account = await this.userRepo.findOne({
      filter: { _id: currentUserId },
      projection: { blockedUsers: 1 },
    });
    if (!account) throw new exceptions.NotFoundException("User not found");

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.userRepo.paggination({
      filter: {
        _id: { $nin: [currentUserId, ...(account.blockedUsers ?? [])] },
        deletedAt: null,
        blockedUsers: { $ne: currentUserId },
        $or: [
          { firstName: { $regex: escapedQuery, $options: "i" } },
          { lastName: { $regex: escapedQuery, $options: "i" } },
        ],
      },
      projection: { firstName: 1, lastName: 1, image: 1 },
      options: { sort: { firstName: 1, lastName: 1, _id: 1 } },
      page,
      limit,
    });
  }

  async suggestUsers({
    user,
    page,
    limit,
  }: {
    user: HUser | ICachedUser;
    page: number;
    limit: number;
  }) {
    const currentUserId = new Types.ObjectId(user._id);
    const account = await this.userRepo.findOne({
      filter: { _id: currentUserId },
      projection: { blockedUsers: 1, following: 1 },
    });
    if (!account) throw new exceptions.NotFoundException("User not found");

    const followingIds = (account.following ?? []).map((entry) => entry.userId);
    return this.userRepo.paggination({
      filter: {
        _id: {
          $nin: [
            currentUserId,
            ...(account.blockedUsers ?? []),
            ...followingIds,
          ],
        },
        deletedAt: null,
        banned: { $ne: true },
        status: { $ne: enums.statusEnum.blocked },
        blockedUsers: { $ne: currentUserId },
      },
      projection: { firstName: 1, lastName: 1, image: 1 },
      options: { sort: { firstName: 1, lastName: 1, _id: 1 } },
      page,
      limit,
    });
  }

  async softDelete({ userId }: { userId: string }) {
    const user = await this.userRepo.findByIdAndUpdate({
      id: new Types.ObjectId(userId),
      update: {
        deletedAt: new Date(),
      },
    });
    if (!user) throw new exceptions.NotFoundException("User not found");
    return user;
  }

  // the user must be soft deleted first
  async hardDelete({ userId }: { userId: string }) {
    const user = await this.userRepo.findByIdAndDelete({
      id: new Types.ObjectId(userId),
    });
    if (!user) throw new exceptions.NotFoundException("User not found");
    return user;
  }

  async getUser({ userId }: { userId: Types.ObjectId }) {
    const user = await this.userRepo.findOne({
      filter: {
        _id: userId,
        paranoid: false,
      },
    });
    if (!user) throw new exceptions.NotFoundException("User not found");
    return user;
  }

  async restore({ userId }: { userId: Types.ObjectId }) {
    const user = await this.userRepo.findOneAndUpdate({
      filter: {
        _id: userId,
        paranoid: false,
        deletedAt: {
          $ne: null,
          $exists: true,
        },
      },
      update: {
        deletedAt: null,
      },
    });
    if (!user) throw new exceptions.NotFoundException("User not found");
    return user;
  }

  async update({
    user,
    userData,
  }: {
    user: HUser;
    userData: {
      firstName?: string;
      lastName?: string;
      accountPrivacy?: enums.accountPrivacyEnum;
    };
  }): Promise<String | Types.ObjectId[] | undefined> {
    const account = await this.userRepo.findById({
      id: user._id,
    });
    if (!account) throw new exceptions.NotFoundException("User not found");
    const pendingRequestIds = account.pendingRequests;

    // update account privacy
    await this.userRepo.findOneAndUpdate({
      filter: {
        _id: user!._id,
      },
      update: userData,
    });

    if (userData.accountPrivacy !== enums.accountPrivacyEnum.public) return;

    // update the current user
    await this.userRepo.updateOne({
      filter: {
        _id: user._id,
      },
      update: {
        $addToSet: {
          followers: {
            $each: pendingRequestIds,
          },
        },
        $pull: {
          pendingRequests: {
            $in: pendingRequestIds,
          },
        },
      },
    });

    // update the pending users
    await this.userRepo.updateMany({
      filter: {
        _id: {
          $in: pendingRequestIds,
        },
        following: {
          $elemMatch: {
            userId: user._id,
            status: enums.followStatusEnum.pending,
          },
        },
      },
      update: {
        $set: {
          "following.$.status": enums.followStatusEnum.accepted,
        },
      },
    });
    return account.pendingRequests;
  }

  async adminUpdate({
    userId,
    userData,
  }: {
    userId: string;
    userData: {
      firstName?: string;
      lastName?: string;
    };
  }) {
    return await this.userRepo.updateOne({
      filter: {
        _id: userId,
      },
      update: userData,
    });
  }

  async upadteImage({
    user,
    file,
  }: {
    user: HUser | ICachedUser;
    file: IFile;
  }): Promise<string> {
    const key = await this.s3Service.uploadAsset({
      folder: `/users/${user._id}profile/`,
      file: file,
    });
    const oldImage = user.image as string;

    const data = await this.userRepo.updateOne({
      filter: { _id: user._id },
      update: { image: key },
    });

    if (oldImage) await this.s3Service.deleteAsset({ Key: oldImage });

    if (!data.modifiedCount) throw new exceptions.BadRequestException();
    return key;
  }

  async preSignedupadteImage({
    user,
    data,
  }: {
    user: HUser | ICachedUser;
    data: any;
  }): Promise<string> {
    const Key = `/users/${user._id}profile/${data.filename}`;
    const url = await this.s3Service.createPresignedUrl({
      Key,
    });
    const oldImage = user.image as string;

    // the lambda function handles this
    // const updateData = await this.userRepo.updateOne({
    //   filter: { _id: user._id },
    //   update: { image: Key },
    // });

    if (oldImage) await this.s3Service.deleteAsset({ Key: oldImage });
    // if (!updateData.modifiedCount) throw new exceptions.BadRequestException();
    return url;
  }

  async updloadCoverImages({
    user,
    files,
  }: {
    user: HUser | ICachedUser;
    files: IFile[];
  }) {
    const keys = await this.s3Service.uploadAssets({
      folder: `/users/${user._id}profile/covers`,
      files,
    });

    const oldCovers: string[] = user.covers as string[];
    const data = await this.userRepo.updateOne({
      filter: { _id: user._id },
      update: {
        $addToSet: {
          covers: keys,
        },
      },
    });
    if (oldCovers.length)
      await this.s3Service.deleteAssets({ keys: oldCovers });
    if (!data.modifiedCount) throw new exceptions.BadRequestException();
    return keys;
  }

  async updloadLargImage({
    user,
    file,
  }: {
    user: HUser | ICachedUser;
    file: IFile;
  }) {
    console.log(file);
    const data = await this.s3Service.uploadLargeImage({
      folder: `/users/${user._id}profile/`,
      file: file,
    });

    this.userRepo.updateOne({
      filter: { id: user._id },
      update: { image: data },
    });
    return data;
  }

  async followUser({
    currentUser,
    targetUserId,
  }: {
    currentUser: HUser | ICachedUser;
    targetUserId: string;
  }): Promise<string> {
    const currentUserId = currentUser._id;
    const targetId = new Types.ObjectId(targetUserId);

    if (currentUserId.toString() === targetUserId)
      throw new exceptions.ForbiddenException("You can't follow yourself");

    const targetUser = await this.userRepo.findOne({
      filter: {
        _id: targetId,
        blockedUsers: { $ne: currentUserId },
      },
    });
    if (!targetUser) throw new exceptions.NotFoundException("User not found");

    const currentUserBlockedTarget = await this.userRepo.findOne({
      filter: {
        _id: currentUserId,
        blockedUsers: targetId,
      },
    });
    if (currentUserBlockedTarget) {
      throw new exceptions.NotFoundException("User not found");
    }

    const pending = await this.userRepo.findOne({
      filter: {
        _id: currentUserId,
        following: {
          $elemMatch: {
            userId: targetId,
            status: enums.followStatusEnum.pending,
          },
        },
      },
    });
    if (pending) return "Follow request already sent";

    const accepted = await this.userRepo.findOne({
      filter: {
        _id: currentUserId,
        following: {
          $elemMatch: {
            userId: targetId,
            status: enums.followStatusEnum.accepted,
          },
        },
      },
    });
    if (accepted) return "You already follow this user";

    const isPublic =
      targetUser.accountPrivacy === enums.accountPrivacyEnum.public;

    const followingResult = await this.userRepo.updateOne({
      filter: {
        _id: currentUserId,
        "following.userId": { $ne: targetId },
      },
      update: {
        $push: {
          following: {
            userId: targetId,
            status: isPublic
              ? enums.followStatusEnum.accepted
              : enums.followStatusEnum.pending,
          },
        },
      },
    });
    if (followingResult.matchedCount === 0) return "You already sent a request";

    if (!isPublic) {
      await this.userRepo.updateOne({
        filter: { _id: targetId },
        update: {
          $addToSet: { pendingRequests: currentUserId },
        },
      });
      return "Follow request sent";
    }

    await this.userRepo.updateOne({
      filter: { _id: targetId },
      update: {
        $addToSet: {
          followers: currentUserId,
        },
      },
    });

    const areMutualFollowers = await this.userRepo.findOne({
      filter: {
        _id: currentUserId,
        following: {
          $elemMatch: {
            userId: targetId,
            status: enums.followStatusEnum.accepted,
          },
        },
        followers: targetId,
      },
    });
    return areMutualFollowers ? "You both follow each other" : "Following";
  }

  async unfollowUser({
    currentUser,
    targetUserId,
  }: {
    currentUser: HUser | ICachedUser;
    targetUserId: string;
  }): Promise<string> {
    const currentUserId = currentUser._id;
    const targetId = new Types.ObjectId(targetUserId);

    if (currentUserId.toString() === targetUserId)
      throw new exceptions.ForbiddenException("You can't unfollow yourself");
    const exists = await this.userRepo.findOne({
      filter: {
        _id: targetId,
        blockedUsers: { $ne: currentUserId },
      },
    });
    if (!exists) throw new exceptions.NotFoundException("User not found");

    const alreadyFollowing = await this.userRepo.findOne({
      filter: {
        _id: currentUserId,
        following: {
          $elemMatch: {
            userId: targetId,
            status: enums.followStatusEnum.accepted,
          },
        },
      },
    });
    if (!alreadyFollowing) return "You are not following this user";

    await this.userRepo.updateOne({
      filter: {
        _id: currentUserId,
      },
      update: {
        $pull: {
          following: {
            userId: targetId,
          },
        },
      },
    });
    await this.userRepo.updateOne({
      filter: { _id: targetId },
      update: {
        $pull: { followers: currentUserId },
      },
    });

    return "You unfollow this user";
  }

  async getPendingRequest(user: HUser | ICachedUser) {
    const account = await this.userRepo.findById({
      id: user._id as Types.ObjectId,
    });
    if (!account) throw new exceptions.NotFoundException("User not found");
    if (account.accountPrivacy !== enums.accountPrivacyEnum.private) return;
    const pendingRequestIds = account.pendingRequests;
    return await this.userRepo.findMany({
      filter: {
        _id: { $in: pendingRequestIds },
      },
      projection: {
        email: 1,
        firstName: 1,
        lastName: 1,
        image: 1,
      },
    });
  }

  async handlePendingRequest({
    currentUser,
    requesterId,
    status,
    followBack,
  }: {
    currentUser: HUser | ICachedUser;
    requesterId: string;
    status: enums.statusEnum;
    followBack?: boolean;
  }): Promise<{
    msg: string;
    followBack: string | null;
  }> {
    const currentUserId = new Types.ObjectId(currentUser._id);
    const requesterObjectId = new Types.ObjectId(requesterId);
    const account = await this.userRepo.findById({
      id: currentUserId,
    });
    if (!account) throw new exceptions.NotFoundException("User not found");

    const requesterUser = await this.userRepo.findOne({
      filter: {
        _id: requesterObjectId,
        following: {
          $elemMatch: {
            userId: currentUserId,
            status: enums.followStatusEnum.pending,
          },
        },
      },
    });
    if (!requesterUser)
      throw new exceptions.NotFoundException("User not found");

    if (status === enums.statusEnum.approved) {
      // update the current user
      const ownerResult = await this.userRepo.updateOne({
        filter: {
          _id: account._id,
          pendingRequests: requesterObjectId,
        },
        update: {
          $addToSet: {
            followers: requesterObjectId,
          },
          $pull: {
            pendingRequests: requesterObjectId,
          },
        },
      });
      if (ownerResult.matchedCount === 0)
        throw new exceptions.NotFoundException("Pending request not found");

      // update the requester
      await this.userRepo.updateOne({
        filter: {
          _id: requesterObjectId,
          following: {
            $elemMatch: {
              userId: currentUserId,
              status: enums.followStatusEnum.pending,
            },
          },
        },
        update: {
          $set: {
            "following.$.status": enums.followStatusEnum.accepted,
          },
        },
      });
      let followBackResult: string | null = null;
      if (followBack) {
        followBackResult = await this.followUser({
          currentUser,
          targetUserId: requesterId,
        });
      }
      return {
        msg: "Follow request approved",
        followBack: followBackResult,
      };
    } else if (status === enums.statusEnum.rejected) {
      // update the current user
      const ownerResult = await this.userRepo.updateOne({
        filter: {
          _id: account._id,
          pendingRequests: requesterObjectId,
        },
        update: {
          $pull: {
            pendingRequests: requesterId,
          },
        },
      });
      if (ownerResult.matchedCount === 0)
        throw new exceptions.NotFoundException("Pending request not found");

      // update the requester
      await this.userRepo.updateOne({
        filter: {
          _id: requesterId,
          following: {
            $elemMatch: {
              userId: currentUserId,
              status: enums.followStatusEnum.pending,
            },
          },
        },
        update: {
          $pull: {
            following: {
              userId: currentUserId,
              status: enums.followStatusEnum.pending,
            },
          },
        },
      });
      return {
        msg: "Follow request rejected",
        followBack: null,
      };
    }
    return {
      msg: "Something went wrong",
      followBack: null,
    };
  }

  async blockUser({
    currentUser,
    targetUserId,
  }: {
    currentUser: HUser | ICachedUser;
    targetUserId: string;
  }): Promise<String> {
    const currentUserId = currentUser._id;
    const targetId = new Types.ObjectId(targetUserId);
    if (currentUserId.toString() === targetId.toString())
      throw new exceptions.ForbiddenException("You can't block yourself");

    const target = await this.userRepo.findOne({
      filter: {
        _id: targetId,
        blockedUsers: {
          $ne: currentUserId,
        },
      },
    });
    if (!target) throw new exceptions.NotFoundException("User not found");

    const isBlocked = await this.userRepo.updateOne({
      filter: {
        _id: currentUserId,
        blockedUsers: {
          $ne: targetId,
        },
      },
      update: { $addToSet: { blockedUsers: targetId } },
    });
    return isBlocked.matchedCount == 0
      ? "User already blocked"
      : "User blocked";
  }

  async unblockUser({
    currentUser,
    targetUserId,
  }: {
    currentUser: HUser | ICachedUser;
    targetUserId: string;
  }) {
    const currentUserId = currentUser._id;
    const targetId = new Types.ObjectId(targetUserId);
    const targetUser = await this.userRepo.findOne({
      filter: {
        _id: targetUserId,
        blockedUsers: {
          $ne: currentUserId,
        },
      },
    });
    if (!targetUser) throw new exceptions.NotFoundException("User not found");
    const isBlocked = await this.userRepo.updateOne({
      filter: { _id: currentUser._id, blockedUsers: targetId },
      update: { $pull: { blockedUsers: new Types.ObjectId(targetUserId) } },
    });
    return isBlocked.modifiedCount == 0
      ? "User not found in you block list"
      : "User unblocked";
  }
}

export const userService = new UserService();
