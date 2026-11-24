import z from "zod";
import { enums, generalFeilds } from "../../common/index.js";

export const createPopstSchema = (lang: enums.languageEnum) =>
  z.object({
    body: z.strictObject({
      content: z
        .string()
        .min(5)
        .max(5000, { error: "charaters must be less than 5000" })
        .optional(),
      tags: z.array(generalFeilds.id(lang)).optional(),
      availability: z
        .enum(enums.availabliityEnum)
        .default(enums.availabliityEnum.public),
    }),
    files: z.array(generalFeilds.file(lang)),
  });
