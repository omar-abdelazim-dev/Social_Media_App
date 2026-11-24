import type { Types } from "mongoose";
import type { ICreateToken } from "../../../common/index.js";

export interface IVerify2FAType {
  message: string;
  require2FA: boolean;
  userId: Types.ObjectId;

}

export interface ILoginWithGoogleReturnType {
  token: ICreateToken;
  status?: number;
}
