import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IResponse } from "../index.js";

export const respopnseFormatter = (handler: Function): RequestHandler => {
  // return middleware
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<any> => {
    // call the function and send to it the req, res and next
    const data: IResponse = await handler(req, res, next);
    // to check if there is a reaponse already sent or not 
    if (res.headersSent) return;
    return res.status(data.status || 200).json({
      msg: data.msg || "done",
      data: data.data || {},
    });
  };
};
