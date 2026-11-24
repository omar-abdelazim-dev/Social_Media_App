import type { NextFunction, Request, Response } from "express";
import * as enums from "../enum/index.js";
import { exceptions, security, tokenService, userRepo } from "../index.js";

// ---------------------- CHECK AUTHORIZATION ----------------
export default async (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  if (!authorization)
    throw new exceptions.BadRequestException("authorization is not defined");
  let [prefix, token] = authorization.split(" ") as [string, string];

  if (!token)
    throw new exceptions.UnauthorizedException("Authinticated users only");
  let user;

  switch (prefix) {
    case enums.authEnum.Basic:
      const data = Buffer.from(token, "base64").toString();
      const [email, password] = data.split(":") as [string, string];
      user = await userRepo.findByEmail({ email });

      if (!user) throw new exceptions.NotFoundException("User not found");
      await security.compare({
        plainText: password as string,
        cipherText: user.password,
      });

      req.user = user;
      next();
      break;

    case enums.authEnum.Bearer:
      // inject new property into request
      req.user = await tokenService.verifyToken({
        token,
        tokenType: enums.tokenTypesEnum.access,
      });

      next();
      break;

    default:
      throw new exceptions.BadRequestException("Invalid auth type");
  }
};
