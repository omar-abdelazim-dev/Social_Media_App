import { z } from "zod";
import { enums } from "../index.js";
import { getErrorMessage } from "./validationErrors.js";
import { isValidObjectId } from "mongoose";

export const generalFeilds = {
  email: (lang: enums.languageEnum) =>
    z
      .email({
        error: getErrorMessage(lang, "email"),
      })
      .regex(/^[A-Za-z0-9_\-\.]+@[A-Za-z\-_]{1,20}(\.[a-z]{2,8}){1,2}$/),
  password: (lang: enums.languageEnum) =>
    z
      .string()
      .max(20, { error: getErrorMessage(lang, "longPassword") })
      .min(6, { error: getErrorMessage(lang, "shortPassword") }),
  cPassword: (lang: enums.languageEnum) => z.string().max(20).min(6),
  phoneNumber: (lang: enums.languageEnum) =>
    z
      .e164({
        pattern: /^\+201[0125]\d{8}$/,
        error: getErrorMessage(lang, "wrongPhoneNumber"),
      })
      .optional(),
  name: (lang: enums.languageEnum) =>
    z
      .string({ error: getErrorMessage(lang, "name.invalidName") })
      .regex(/^[A-Za-z]{3,20}\s[A-Za-z]{3,20}$/, {
        error: getErrorMessage(lang, "name.twoNames"),
      }),
  DOB: (lang: enums.languageEnum) => z.string(),
  scores: (lang: enums.languageEnum) =>
    z.array(z.number()).nonempty().optional(),
  gender: (lang: enums.languageEnum) =>
    z.enum(enums.genderEnum, {
      error: getErrorMessage(lang, "gender"),
    }),
  id: (lang: enums.languageEnum) =>
    z
      .string()
      .min(14)
      .max(24)
      .refine((value) => isValidObjectId(value), {
        error: getErrorMessage(lang, "invalidObjectId"),
      }),
  page: (lang: enums.languageEnum) => z.coerce.number().gte(1),
  limit: (lang: enums.languageEnum) => z.coerce.number().gte(1),
  stringBool: (lang: enums.languageEnum) =>
    z.stringbool({
      truthy: ["true"],
      falsy: ["false"],
      error: getErrorMessage(lang, "stringBool"),
    }),
  headers: (lang: enums.languageEnum) =>
    z.object({
      authorization: z.string().refine(
        (val) => {
          const [prefix, token] = (val || "").split(" ");
          return (
            prefix === "Bearer" && z.string().jwt().safeParse(token).success
          );
        },
        { message: "Invalid Bearer token" },
      ),
      "accept-lang:stringuage": z
        .enum(["ar", "en"], {
          error: getErrorMessage(lang, "lang:stringuage"),
        })
        .optional(),
    }),
  file: (lang: enums.languageEnum) =>
    z.object({
      fieldname: z.string(),
      originalname: z.string(),
      encoding: z.string(),
      mimetype: z.string(),
      size: z.number().optional(),
      path: z.string().optional(),
      destination: z.string().optional(),
      filename: z.string().optional(),
      buffer: z.any().optional(),
    }),
};
