import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { enums, type IUser } from "../../common/index.js";

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: {
      type: String,
      trim: true,
      required: true,
      minlength: [3, "First name must be more than 3 charachters"],
      maxlength: [10, "First name must be less than 20 charachters"],
    },
    lastName: {
      type: String,
      trim: true,
      required: true,
      minlength: [3, "Last name must be more than 3 charachters"],
      maxlength: [10, "Last name must be less than 20 charachters"],
    },
    email: {
      type: String,
      trim: true,
      unique: true,
      required: true,
      lowercase: true,
    },
    password: {
      type: String,
      trim: true,
      required: function (): boolean {
        return this.provider == enums.providerEnum.system;
      },
      minlength: [6, "Password name must be more than 6 charachters"],
    },
    gender: {
      type: Number,
      enum: enums.genderEnum,
    },
    provider: {
      type: Number,
      enum: enums.providerEnum,
      default: enums.providerEnum.system,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: Number,
      enum: enums.roleEnum,
      default: enums.roleEnum.user,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    banned: {
      type: Boolean,
      default: false,
    },
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        status: {
          type: String,
          enum: Object.values(enums.followStatusEnum),
          required: true,
        },
      },
    ],
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    status: {
      type: String,
      enum: Object.values(enums.statusEnum),
    },
    accountPrivacy: {
      type: String,
      enum: Object.values(enums.accountPrivacyEnum),
      default: enums.accountPrivacyEnum.public,
    },
    pendingRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    credintialsChangedAt: Number,
    confirmEmail: Boolean,
    deletedAt: Date,
    image: String,
    covers: [String],
    DOB: Date,
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    strictQuery: true,
    timestamps: true,
    strict: true,
  },
);

userSchema
  .virtual("name")
  .set(function (fullName) {
    const [firstName, lastName] = fullName.split(" ");
    this.firstName = firstName;
    this.lastName = lastName;
  })
  .get(function () {
    return `${this.firstName} ${this.lastName}`;
  });

userSchema.pre(
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
userSchema.pre(
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
userSchema.pre(
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

export type HUser = HydratedDocument<IUser>;
export const userModel = mongoose.model<IUser>("user", userSchema, "user");
