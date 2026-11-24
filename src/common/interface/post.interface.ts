import type { Types } from "mongoose";
import type { IUser } from "./user.interface.js";
import type { enums } from "../index.js";

export interface IPost {
  content?: string;
  attachments?: string[];
  folderId: string;
  tags?: Types.ObjectId[] | IUser[];
  availability?: enums.availabliityEnum;
  createdBy: Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  restoredAt?: Date;
}
