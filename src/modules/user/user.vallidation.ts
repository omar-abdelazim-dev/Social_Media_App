import { z } from "zod";
import { generalFeilds, enums } from "../../common/index.js";

export const softDeleteSchema = (lang: enums.languageEnum) =>
  z.object({
    body: z.strictObject({
      userId: generalFeilds.id(lang),
    }),
  });

export const getUserSchema = (lang: enums.languageEnum) =>
  z.object({
    params: z.strictObject({
      userId: generalFeilds.id(lang),
    }),
  });

export const handlePendingRequestSchema = (lang: enums.languageEnum) =>
  z.object({
    params: z.strictObject({
      userId: generalFeilds.id(lang),
    }),
    body: z.strictObject({
      status: z.enum([enums.statusEnum.approved, enums.statusEnum.rejected]),
      followBack: z.boolean().optional(),
    }),
  });

export const searchUsersSchema = (_lang: enums.languageEnum) =>
  z.object({
    query: z.strictObject({
      q: z.string().trim().min(1).max(100),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  });

export const suggestUsersSchema = (_lang: enums.languageEnum) =>
  z.object({
    query: z.strictObject({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  });

export const userUpdateSchema = (lang: enums.languageEnum) =>
  z.object({
    body: z.strictObject({
      firstName: z.string().min(2).max(10).optional(),
      lastName: z.string().min(2).max(10).optional(),
      accountPrivacy: z.enum(enums.accountPrivacyEnum).optional(),
    }),
  });
