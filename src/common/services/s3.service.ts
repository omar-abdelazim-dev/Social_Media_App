import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type CompleteMultipartUploadCommandOutput,
  type DeleteObjectCommandOutput,
  type GetObjectCommandOutput,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  aws_access_key_id,
  aws_bucket_name,
  aws_region,
  aws_secret_access_key,
} from "../../config/config.service.js";
import { enums, type IFile } from "../index.js";
import { readFileSync } from "node:fs";

export class S3Service {
  private readonly client: S3Client;
  constructor() {
    this.client = new S3Client({
      region: aws_region,
      credentials: {
        accessKeyId: aws_access_key_id,
        secretAccessKey: aws_secret_access_key,
      },
    });
  }

  // maximum 5 mega per file
  async uploadImage({
    Key,
    file,
    storage = enums.storageEnum.disk,
  }: {
    Key: string;
    file: IFile;
    storage?: enums.storageEnum;
  }) {
    return this.client.send(
      new PutObjectCommand({
        Bucket: aws_bucket_name,
        Key: `${Key}/${file.filename}`,
        Body:
          storage == enums.storageEnum.disk
            ? readFileSync(file.fullPath || file.path)
            : file.buffer,
        // default value
        ACL: "private",
      }),
    );
  }

  // more than 5 mega per file
  async uploadLargeImage({
    folder,
    file,
    storage = enums.storageEnum.disk,
  }: {
    folder: string;
    file: IFile;
    storage?: enums.storageEnum;
  }) {
    const data = new Upload({
      client: this.client,
      params: {
        Bucket: aws_bucket_name,
        Key: `${folder}/${file.filename}`,
        ACL: "private",
        Body:
          storage == enums.storageEnum.disk
            ? readFileSync(file.fullPath || file.path)
            : file.buffer,
        ContentType: file.mimetype,
      },
    });
    data.on("httpUploadProgress", (progress) => {});
    return await data.done();
  }

  async uploadLargeImages({
    folder,
    storage = enums.storageEnum.disk,
    files,
  }: {
    folder: string;
    storage?: enums.storageEnum;
    files: IFile[];
  }): Promise<CompleteMultipartUploadCommandOutput[]> {
    // start uploading files at the same time
    let promises = files.map((file) =>
      this.uploadLargeImage({ folder, file, storage }),
    );
    return await Promise.all(promises);
  }

  // maximum 5 mega per file
  async uploadAsset({
    folder,
    file,
    storage = enums.storageEnum.disk,
  }: {
    folder: string;
    file: IFile;
    storage?: enums.storageEnum;
  }) {
    // key save the image path
    const Key = `${folder}/${file.originalname}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: aws_bucket_name,
        Key,
        Body:
          storage == enums.storageEnum.disk
            ? readFileSync(file.fullPath || file.path)
            : file.buffer,
        // default value
        ACL: "private",
      }),
    );
    return Key;
  }

  async uploadAssets({
    folder,
    storage = enums.storageEnum.disk,
    files,
  }: {
    folder: string;
    storage?: enums.storageEnum;
    files: IFile[];
  }): Promise<string[]> {
    // start uploading files at the same time
    let promises: Promise<string>[] = files.map((file) =>
      this.uploadAsset({ folder, file, storage }),
    );
    return await Promise.all(promises);
  }

  // send getObjectCommand to s3 to return a stream
  async getAsset({ Key }: { Key: string }): Promise<GetObjectCommandOutput> {
    const command = new GetObjectCommand({
      Bucket: aws_bucket_name,
      Key,
    });
    return await this.client.send(command);
  }

  async deleteAssets({
    keys,
  }: {
    keys: string[];
  }): Promise<DeleteObjectCommandOutput> {
    const command = new DeleteObjectsCommand({
      Bucket: aws_bucket_name,
      Delete: {
        Objects: keys.map((Key: string) => ({ Key })),
      },
    });
    return await this.client.send(command);
  }

  async deleteAsset({
    Key,
  }: {
    Key: string;
  }): Promise<DeleteObjectCommandOutput> {
    const command = new DeleteObjectCommand({
      Bucket: aws_bucket_name,
      Key,
    });
    return await this.client.send(command);
  }

  async listObject({
    key,
  }: {
    key: string;
  }): Promise<ListObjectsV2CommandOutput> {
    const command = new ListObjectsV2Command({
      Bucket: aws_bucket_name,
      // folder name
      Prefix: key,
    });
    return await this.client.send(command);
  }

  async deleteFolder({ key }: { key: string }): Promise<void> {
    const data = await this.listObject({ key });
    const keys = data.Contents?.map((cont) => cont.Key) as string[];
    if (keys.length) await this.deleteAssets({ keys });
  }

  async createPresignedUrl({ Key }: { Key: string }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: aws_bucket_name,
      Key,
      // default value
      ACL: "private",
    });
    return await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });
  }

  async createGetPresignedUrl({
    Key,
    filename,
    download = false,
  }: {
    Key: string;
    filename?: string;
    download?: boolean;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: aws_bucket_name,
      Key,
      ...(download
        ? { ResponseContentDisposition: `attachrnent; filename="${filename}"` }
        : {}),
    });
    return await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });
  }
}

export const s3Service = new S3Service();
