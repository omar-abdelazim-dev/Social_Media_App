import { Types } from "mongoose";
import type { enums, IFollowing } from "../index.js";

export interface IUser {
  credintialsChangedAt: number;
  twoFactorEnabled: boolean;
  provider: enums.providerEnum;
  confirmEmail: boolean;
  phoneNumber: string;
  gender: enums.genderEnum;
  paranoid?: boolean;
  changedAt: number;
  updatedAt: number;
  firstName: string;
  userName?: string;
  lastName: string;
  password: string;
  deletedAt: Date;
  banned: boolean;
  role: enums.roleEnum;
  image: string;
  covers: String[];
  email: string;
  DOB: Date;
  following: IFollowing[];
  followers: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  pendingRequests: Types.ObjectId[];
  status: enums.statusEnum;
  accountPrivacy: enums.accountPrivacyEnum;
  friends?: Types.ObjectId[];
}
