import type { Types } from "mongoose";

export interface IFollowing {
  userId: Types.ObjectId;
  status: "pending" | "accepted";
}
