import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  authService,
  type ILoginWithGoogleReturnType,
  type IVerify2FAType,
} from "./index.js";
import {
  authMiddleware,
  respopnseFormatter,
  validator,
  type ICreateToken,
  type IResponse,
} from "../../common/index.js";
import * as authValidation from "./auth.validation.js";
import type { HUser } from "../../database/index.js";

export const authRouter = Router({
  caseSensitive: true,
  strict: true,
});

// ---------------------- SIGNUP -----------------------------
authRouter.post(
  "/signup",
  validator(authValidation.signupSchema),
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<HUser>> => {
      const user: HUser = await authService.createUser({
        userData: req.body,
        file: null,
      });
      return {
        status: 201,
        data: user,
        msg: "User created",
      };
    },
  ),
);

// ---------------------- CONFIRM EMAIL ----------------------
authRouter.post(
  "/confirmEmail",
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<HUser | void>> => {
      const user = await authService.confirmEmail(req.body);
      return {
        status: 200,
        data: user,
        msg: "Email confirmed",
      };
    },
  ),
);

// ---------------------- LOGIN ------------------------------
authRouter.post(
  "/login",
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<IVerify2FAType | ICreateToken>> => {
      const issuer = `${req.protocol}//${req.hostname}`;
      const token: IVerify2FAType | ICreateToken = await authService.login({
        userData: req.body,
        issuer,
        FCMToken: req.body.FCMToken,
      });
      return {
        status: 200,
        data: token,
        msg: "Loged in",
      };
    },
  ),
);

// ---------------------- LOGIN WITH GOOGLE ------------------
authRouter.post(
  "/loginWithGmail",
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<IVerify2FAType | ICreateToken>> => {
      const issuer: string = `${req.protocol}://${req.host}`;
      const { token, status }: ILoginWithGoogleReturnType =
        await authService.loginWithGmail({
          idToken: req.body,
          issuer,
        });
      return {
        status: status as number,
        data: token,
        msg: status == 201 ? "User created" : "User loged in",
      };
    },
  ),
);

// ---------------------- LOGOUT -----------------------------
authRouter.post(
  "/logout",
  authMiddleware,
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<null>> => {
      const data = await authService.logout({
        auth: req.headers.authorization as string,
        type: req.body.type,
      });
      return {
        status: 200,
        data: null,
        msg: "Loged out",
      };
    },
  ),
);

// ---------------------- REFRESH TOKEN ----------------------
authRouter.get(
  "/refreshToken",
  validator(authValidation.refreshTokenSchema),
  respopnseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<IVerify2FAType | ICreateToken>> => {
      const refreshToken = req.headers.authorization as string;
      const issuer: string = `${req.protocol}//${req.hostname}`;
      const tokens: ICreateToken = await authService.refreshToken({
        refreshToken,
        issuer,
      });
      return {
        status: 200,
        data: tokens,
        msg: "Tokens refreshed",
      };
    },
  ),
);
