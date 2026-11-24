import mongoose, { Schema, Types, type HydratedDocument } from "mongoose";
import { enums, type IPost } from "../../common/index.js";

const postSchema = new mongoose.Schema<IPost>(
  {
    content: {
      type: String,
      required: function (): boolean {
        return this?.attachments?.length! > 0;
      },
    },
    availability: {
      type: String,
      enum: enums.availabliityEnum,
      default: enums.availabliityEnum.public,
    },
    createdBy: {
      type: Types.ObjectId,
      requierd: true,
    },
    tags: [Types.ObjectId],
    deletedAt: Date,
    restoredAt: Date,
    folderId: String,
    attachments: [String],
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    strictQuery: true,
    timestamps: true,
    strict: true,
  },
);

postSchema.pre(
  ["findOne", "findOneAndUpdate"],
  {
    document: false,
    query: true,
  },
  // return the existing user for admin only
  function () {
    const { paranoid } = this.getFilter();
    if (paranoid !== false) {
      this.setQuery({
        ...this.getQuery(),
        $or: [
          {
            deletedAt: {
              $exists: false,
            },
          },
          {
            deletedAt: null,
          },
        ],
      });
    }
  },
);

// prevent updating the deleted users
postSchema.pre(
  ["updateOne", "findOneAndUpdate"],
  {
    document: false,
    query: true,
  },
  // return the existing user for admin only
  function () {
    const { paranoid } = this.getFilter();
    if (paranoid !== false) {
      this.setQuery({
        ...this.getQuery(),
        $or: [
          {
            deletedAt: {
              $exists: false,
            },
          },
          {
            deletedAt: null,
          },
        ],
      });
    }
  },
);

// delete the soft deleted users only
postSchema.pre(
  ["deleteOne", "findOneAndDelete"],
  {
    document: false,
    query: true,
  },
  function () {
    this.setQuery({
      ...this.getQuery(),
      deletedAt: {
        $exists: true,
        $ne: null,
      },
    });
  },
);

export type HPost = HydratedDocument<IPost>;
export const postModel = mongoose.model<IPost>("post", postSchema, "post");
