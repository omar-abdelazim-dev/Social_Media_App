import jwt from "jsonwebtoken";
import { max_retries, refresh_ex } from "../../config/config.service.js";
import crypto from "crypto";
import type { HydratedDocument } from "mongoose";
import { cacheService, type CacheService } from "../../common/services/cache.service.js";
import {
  userRepo,
  exceptions,
  services,
  type IUser,
  enums,
  eventEmitter,
  tokenService,
  type ICreateToken,
} from "../../common/index.js";

// ---------------------- FUNCTIONS TYPES --------------------
interface CreateAndSendOtpType {
  user: HydratedDocument<IUser>;
  event: string;
}

interface BlockUserType {
  userId: string;
  userOtpKey?: string;
}

interface CheckUserType {
  email?: string;
  id?: string;
  exists?: boolean;
}
// -----------------------------------------------------------

export class AuthHelpers {
  private readonly cacheService: CacheService;
  constructor() {
    this.cacheService = cacheService;
  }

  generateOtp = (): number => crypto.randomInt(100000, 1000000);

  getUserKey = (userId: string): string => `user::${userId?.toString()}`;

  getUserOTPKey = (userId: string): string => `otp::${this.getUserKey(userId)}`;

  getUserLoginTriesKey = (userId: string): string =>
    `tries::login::${this.getUserKey(userId)}`;

  getUserOTPForgetKey = (userId: string): string =>
    `forget::${this.getUserOTPKey(userId)}`;

  getUserOtpTriesKey = (userId: string): string =>
    `tries::${this.getUserOTPKey(userId)}`;

  getUserSendKey = (userId: string): string =>
    `send::${this.getUserKey(userId)}`;

  getUser2FAKey = (userId: string): string =>
    `2fa::${this.getUserOTPKey(userId)}`;

  async handleFailedLogin(userId: string): Promise<void> {
    const key = this.getUserLoginTriesKey(userId);
    let tries = 1;

    if (await this.cacheService.exists({ key })) {
      tries = await this.cacheService.incr({ key });
    } else {
      await this.cacheService.set({ key, value: 1, ttl: 15 * 60 });
    }

    if (tries >= max_retries) {
      await this.cacheService.del({ key: [key] });
      await userRepo.updateOne({
        filter: {
          _id: userId,
        },
        update: {
          $set: {
            banned: true,
          },
        },
      });
      throw new exceptions.TooManyRequestException(
        "Too many failed attempts. You got banned, please contact support",
      );
    }
    throw new exceptions.BadRequestException("Invalid email or password");
  }

  // ---------------------- CREATE & SEND OTP ------------------
  async createAndSendOtp({ user, event }: CreateAndSendOtpType): Promise<void> {
    const otp = this.generateOtp();
    const key =
      event === enums.eventEnum.forget
        ? this.getUserOTPForgetKey(user?.id)
        : this.getUserOTPKey(user?.id);

    await services.cacheService.set({
      key: key,
      value: otp,
      ttl: 5 * 60,
    });

    eventEmitter.emit(event, {
      recipients: { to: user?.email },
      otp,
      name: `${user?.firstName} ${user?.lastName}`,
    });
  }

  // ---------------------- REVOKE TOKEN -----------------------
  async revokedToken(token: string): Promise<void> {
    const data = jwt.decode(token) as jwt.JwtPayload | null;
    if (!data || !data.iat || !data.sub || !data.jti)
      throw new exceptions.BadRequestException("Token not valid");

    const currentTimeInSec = Math.ceil(Date.now() / 1000);
    const iat: number = currentTimeInSec - data.iat;
    const ttl = refresh_ex - iat;

    if (ttl > 0) {
      await this.cacheService.set({
        key: tokenService.getRevokeKey({ userId: data.sub, jti: data.jti }),
        value: 1,
        ttl,
      });
    }
  }

  // ---------------------- WRONG OTP --------------------------
  async wrongOtpHandler(userId: string): Promise<void> {
    const key = this.getUserOtpTriesKey(userId.toString());
    if (await this.cacheService.exists({ key })) {
      await this.cacheService.incr({ key });
    } else {
      await this.cacheService.set({ key, value: 1, ttl: 5 * 60 });
    }
    throw new exceptions.BadRequestException("Wrong OTP");
  }

  // ---------------------- BLOCK USER -------------------------
  async blockUser({ userId, userOtpKey }: BlockUserType): Promise<void> {
    const triesKey = this.getUserOtpTriesKey(userId);
    const userOtpRetries = await this.cacheService.get({
      key: triesKey,
    });

    if (userOtpRetries && Number(userOtpRetries) >= max_retries) {
      if (userOtpKey) {
        await this.cacheService.del({ key: [userOtpKey] });
      }

      await userRepo.updateOne({
        filter: {
          _id: userId,
        },
        update: {
          $set: {
            banned: true,
          },
        },
      });

      throw new exceptions.TooManyRequestException(
        "You got banned, please contact support",
      );
    }
  }

  // ---------------------- VERIFY LOGIN -----------------------
  async verifyLogin({
    user,
    issuer,
  }: {
    user: HydratedDocument<IUser>;
    issuer: string;
  }): Promise<ICreateToken> {
    eventEmitter.emit(enums.eventEnum.login, {
      recipients: { to: user?.email },
      subject: "New login",
      text: `a new login detected at ${new Date()}, if it's not you please change the password`,
    });

    return tokenService.createToken({
      userId: user?.id,
      issuer,
      role: user?.role,
    });
  }

  // ---------------------- CHECK USER HELPER ------------------
  async checkUser({
    email,
    id,
    exists = true,
  }: CheckUserType): Promise<HydratedDocument<IUser> | null> {
    let user: HydratedDocument<IUser> | null = null;

    if (id) {
      // user = await userRepo.findById({ id });
    } else if (email) {
      user = await userRepo.findByEmail({ email });
    }

    if (exists && !user) {
      throw new exceptions.NotFoundException("User not found");
    } else if (!exists && user) {
      throw new exceptions.ConflictException("User already exists");
    }

    return user;
  }
}

export const authHelpers = new AuthHelpers();
