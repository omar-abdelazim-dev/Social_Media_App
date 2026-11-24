import type { NextFunction, Request, Response } from "express";
import type { IError } from "../interface/index.js";

export const errorHandler = (
  err: IError,
  req: Request,
  res: Response,
  next: NextFunction,
): Response => {
  console.error(err);

  if (err?.name === "ValidationError") {
    return res.status(400).json({
      msg: "Validation failed",
      errors: Object.values(err.errors ?? {}).map(
        (error: any) => error.message,
      ),
    });
  }

  if (err?.name === "JsonWebTokenError") {
    return res.status(400).json({
      msg: "Invalid signature",
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      msg: "An account with this email already exists",
    });
  }

  return res.status(err?.statusCode || err?.status || 500).json({
    error: err?.name || "Error",
    msg: err?.message || "Internal server error",
    stack: err.stack
  });
};
