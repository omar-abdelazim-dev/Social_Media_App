import { z } from "zod";
import { generalFeilds } from "../../common/index.js";
import type { enums } from "../../common/index.js";

const loginBody = (lang: enums.languageEnum) =>
  // return zod schema
  z.object({
    email: generalFeilds.email(lang),
    password: generalFeilds.password(lang),
  });

export const loginSchema = (lang: enums.languageEnum) =>
  z.object({
    body: loginBody(lang),
  });

const signupBody = (lang: enums.languageEnum) =>
  loginBody(lang)
    .safeExtend({
      cPassword: generalFeilds.cPassword(lang),
      phoneNumber: generalFeilds.phoneNumber(lang),
      name: generalFeilds.name(lang),
      gender: generalFeilds.gender(lang),
      DOB: generalFeilds.DOB(lang),
      scores: generalFeilds.scores(lang),
    })
    .superRefine((data: any, ctx: z.RefinementCtx) => {
      if (data.cPassword !== data.password) {
        ctx.addIssue({
          code: "custom",
          path: ["confirm password"],
          message: "Password don't match confirm password",
        });
      }
      if (data.name.toLocaleLowerCase().includes("admin")) {
        ctx.addIssue({
          code: "invalid_value",
          path: ["name"],
          message: "invalid name",
          values: [data.fullName],
        });
      }
    });

export const signupSchema = (lang: enums.languageEnum) =>
  z.object({
    body: signupBody(lang),
    file: generalFeilds.file(lang).optional(),
  });

export const refreshTokenSchema = (lang: enums.languageEnum) =>
  z.object({
    headers: generalFeilds.headers(lang).passthrough(),
  });
