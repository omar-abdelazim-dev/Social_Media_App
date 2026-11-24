import type { NextFunction, Request, Response } from "express";
import { enums } from "../index.js";
import { z } from "zod";
import { exceptions } from "../index.js";

type validationSChema = (lang: enums.languageEnum) => z.ZodType;

export const validator = (schema: validationSChema) => {
  // schema returns as a function
  return (req: Request, res: Response, next: NextFunction): any => {
    const lang = Number(req.headers["lang"]) || enums.languageEnum.en;
    const { success, error, data } = schema(lang).safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
      files: req.files,
      file: req.file,
    });

    if (!success) {
      throw new exceptions.BadRequestException(
        "Validation Error",
        error?.issues,
      );
    }
    req.validate = data;
    return next();
  };
};
