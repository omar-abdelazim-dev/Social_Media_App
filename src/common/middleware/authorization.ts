import type { Request, Response, NextFunction } from "express";
import { exceptions } from "../exceptions/index.js";
import type { enums } from "../index.js";

export const roleBasedAccessMiddleware = (roles: enums.roleEnum[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = Number(req.user!.role);
    if (!roles.includes(userRole))
      throw new exceptions.ForbiddenException("Authnticated users only");

    next();
  };
};
