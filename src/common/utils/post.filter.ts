import type { HUser } from "../../database/index.js";
import { enums } from "../index.js";

export const getPostFilter = (user: HUser) => {
  return [
    { availability: enums.availabliityEnum.public },
    {
      availability: enums.availabliityEnum.onlyMe,
      createdBy: user._id,
    },
    {
      availability: enums.availabliityEnum.friends,
      createdBy: { $in: [user._id, ...(user.friends! || [])] },
    },
    {
      tags: {
        $in: [user._id],
      },
    },
  ];
};
