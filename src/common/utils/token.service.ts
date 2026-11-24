import * as configService from "../../config/config.service.js";
import * as enums from "../enum/index.js";
import crypto from "crypto";
import { exceptions } from "../exceptions/index.js";
import jwt from "jsonwebtoken";
import {
  services,
  userRepo,
  type ICreateToken,
  type ICachedUser,
} from "../index.js";
import { authHelpers } from "../../modules/auth/auth.helper.js";
import { Types } from "mongoose";
import type { HUser } from "../../database/index.js";

// ---------------------- FUNCTIONS TYPES --------------------

type CreateTokenType = {
  userId: Types.ObjectId | string;
  issuer: string;
  role?: enums.roleEnum;
};

type VerifyTokenToken = {
  token: string;
  tokenType: number;
};

type GetTokenSecretForTypeType = {
  tokenType: number;
  role: number;
};

type GetRevokeKeyType = {
  userId: string;
  jti: string;
};
// -----------------------------------------------------------

class TokenService {
  constructor() {}

  createToken({
    userId,
    issuer,
    role = enums.roleEnum.user,
  }: CreateTokenType): ICreateToken {
    const secrets = this.getTokenSecretsForRole(role);
    const jwtid = crypto.randomUUID();

    return {
      accessToken: jwt.sign(
        {
          sub: userId,
          aud: role,
        },
        secrets.access,
        {
          expiresIn: configService.access_ex,
          issuer,
          jwtid,
        },
      ),
      refreshToken: jwt.sign(
        {
          sub: userId,
          aud: role,
        },
        secrets.refresh,
        {
          expiresIn: configService.refresh_ex,
          issuer,
          jwtid,
        },
      ),
    };
  }

  async verifyToken({
    token,
    tokenType,
  }: VerifyTokenToken): Promise<HUser | ICachedUser | undefined> {
    const decoded = jwt.decode(token);

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded?.sub !== "string" ||
      typeof decoded?.jti !== "string" ||
      typeof decoded?.aud !== "number"
    ) {
      throw new exceptions.UnauthorizedException("Invalid token");
    }

    const userId = decoded.sub;
    const jti: string = decoded.jti;

    // check if user loged out or not
    if (
      await services.cacheService.exists({
        key: this.getRevokeKey({ userId, jti }),
      })
    ) {
      throw new exceptions.UnauthorizedException("You are already loged out");
    }

    const secret: string = this.getTokenSecretForType({
      tokenType,
      role: decoded?.aud,
    });

    try {
      jwt.verify(token, secret);
    } catch (e: any) {
      if (e.name === "TokenExpiredError")
        throw new exceptions.UnauthorizedException("Token expired");
      throw e;
    }

    const userKey = authHelpers.getUserKey(decoded?.sub);

    if (
      await services.cacheService.exists({
        key: userKey,
      })
    ) {
      const cachedUser = await services.cacheService.get<ICachedUser>({
        key: userKey,
      });

      if (!cachedUser || typeof cachedUser !== "object") {
        throw new exceptions.UnauthorizedException("User not found");
      }

      const credentialsChangedAt = cachedUser.credintialsChangedAt;

      const cachedCredsInSec =
        typeof credentialsChangedAt === "number"
          ? credentialsChangedAt > 1e11
            ? Math.floor(credentialsChangedAt / 1000)
            : credentialsChangedAt
          : undefined;

      if (
        cachedCredsInSec !== undefined &&
        decoded.iat !== undefined &&
        decoded.iat <= cachedCredsInSec
      ) {
        throw new exceptions.UnauthorizedException(
          "You are already logged out",
        );
      }

      return cachedUser;
    }
    const user = await userRepo.findById({
      id: new Types.ObjectId(decoded.sub),
      select: [
        "name",
        "firstName",
        "lastName",
        "email",
        "role",
        "gender",
        "phoneNumber",
        "accountPrivacy",
        "following",
        "followers",
        "pendingRequests",
        "credintialsChangedAt",
        "_id",
      ],
    });
    if (!user) throw new exceptions.NotFoundException("User not found");

    const userCredsInSec =
      user.credintialsChangedAt > 1e11
        ? Math.floor(user.credintialsChangedAt / 1000)
        : user.credintialsChangedAt;

    if (!decoded || typeof decoded === "string" || !decoded.iat) {
      throw new exceptions.UnauthorizedException("Invalid token");
    }
    if (userCredsInSec && decoded.iat <= userCredsInSec) {
      throw new exceptions.UnauthorizedException("You are already loged out");
    }

    // cache loged in user for 30 sec
    await services.cacheService.set({
      key: userKey,
      value: user,
      ttl: 30,
    });
    return user;
  }

  getTokenSecretsForRole(role: number) {
    let secret;
    switch (Number(role)) {
      case enums.roleEnum.admin:
        secret = {
          access: configService.admin_access_secret_key,
          refresh: configService.admin_refresh_secret_key,
        };

        break;
      case enums.roleEnum.user:
        secret = {
          access: configService.user_access_secret_key,
          refresh: configService.user_refresh_secret_key,
        };
        break;

      default:
        throw new exceptions.ServerException("Unhandled role");
    }
    return secret;
  }

  getTokenSecretForType({ tokenType, role }: GetTokenSecretForTypeType) {
    let secrets = this.getTokenSecretsForRole(role);
    let secret;
    switch (tokenType) {
      case enums.tokenTypesEnum.access:
        secret = secrets.access;
        break;
      default:
        secret = secrets.refresh;
        break;
    }
    return secret;
  }

  getRevokeKey = ({ userId, jti }: GetRevokeKeyType): string =>
    `revokeToken::${userId}::${jti}`;
  getPrefixRevoke = (userId: Types.ObjectId | string): string =>
    `revokeToken::${userId}`;
}

export const tokenService = new TokenService();
