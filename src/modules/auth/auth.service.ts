import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { EventEmitter } from "node:events";
import {
  google_client_id,
  max_send_retries,
} from "../../config/config.service.js";
import jwt from "jsonwebtoken";
import {
  security,
  eventEmitter,
  enums,
  exceptions,
  services,
  tokenService,
  userRepo,
  type UserRepo,
  type ICreateToken,
} from "../../common/index.js";
import { AuthHelpers, authHelpers } from "./auth.helper.js";
import type {
  signUpDTO,
  signInDTO,
  IVerify2FAType,
  ILoginWithGoogleReturnType,
} from "./index.js";
import type { HUser } from "../../database/index.js";
import {
  notificationService,
  type NotificationService,
} from "../../common/services/notification.service.js";

// ---------------------- FUNCTIONS TYPES --------------------
interface ILoginWithGoogleType {
  idToken: string;
  issuer: string;
}

interface IRefreshTokenType {
  refreshToken: string;
  issuer: string;
}

interface ICreateUserType {
  userData: signUpDTO;
  file: any;
}

interface ILoginType {
  userData: signInDTO;
  issuer: string;
  FCMToken?: string;
}

interface ILogoutType {
  auth: string;
  type: enums.logoutEnum;
}

interface IConfirmEmailtype {
  email: string;
  otp: string;
}

interface IResendOTPType {
  email: string;
  topic: enums.eventEnum;
}

interface IForgetPasswordType {
  email: string;
  otp: number;
  newPassword: string;
  cPassword: string;
}

interface IVerify2FALogin {
  userId: string;
  issuer: string;
  otp: number;
}
// -----------------------------------------------------------

class AuthService {
  private readonly userRepo: UserRepo;
  private readonly chacheService: services.CacheService;
  private readonly eventEmitter: EventEmitter;
  private readonly authHelpers: AuthHelpers;
  private readonly notificationService: NotificationService;

  constructor() {
    this.userRepo = userRepo;
    this.chacheService = services.cacheService;
    this.eventEmitter = eventEmitter;
    this.authHelpers = authHelpers;
    this.notificationService = notificationService;
  }

  // ---------------------- REFRESH TOKEN ----------------------
  async refreshToken({
    refreshToken,
    issuer,
  }: IRefreshTokenType): Promise<ICreateToken> {
    const authorization: string = refreshToken;
    const [prefix, token] = authorization.split(" ");

    if (!token) throw new exceptions.ServerException("Invalid token");
    const user = await tokenService.verifyToken({
      token,
      tokenType: enums.tokenTypesEnum.refresh,
    });
    if (!user) throw new exceptions.NotFoundException("User not found");

    // revoke the old refresh token
    await this.authHelpers.revokedToken(token);
    if (typeof user.id !== "string")
      throw new exceptions.ServerException("Invalid id type");
    if (!user._id) throw new exceptions.ServerException("Invalid id type");
    if (typeof user.role !== "number")
      throw new exceptions.ServerException("Invalid role type");

    return tokenService.createToken({
      userId: user.id,
      issuer,
      role: user.role,
    });
  }

  // ---------------------- SIGNUP -----------------------------
  async createUser({ userData, file }: ICreateUserType): Promise<HUser> {
    const { email, password } = userData;
    let imagePath = "";

    if (file?.path) {
      const normalizedPath = file.path.replace(/\\/g, "/");
      imagePath = `/uploads${normalizedPath.split("/uploads")[1]}`;
    } else if (file?.fullPath) imagePath = file.fullPath.replace(/\\/g, "/");

    await this.authHelpers.checkUser({ email, exists: false });

    if (typeof userData?.phoneNumber !== "string")
      throw new exceptions.ServerException("Invalid phone number type");
    const user = await userRepo.create({
      data: {
        ...userData,
        DOB: new Date(userData.DOB),
        password: await security.hash(password),
        phoneNumber: security.encrypting(userData.phoneNumber),
        image: imagePath,
      },
    });
    user.phoneNumber = userData.phoneNumber;

    await this.authHelpers.createAndSendOtp({
      user,
      event: enums.eventEnum.signup,
    });
    return user;
  }

  // ---------------------- CONFIRM EMAIL ----------------------
  async confirmEmail({ email, otp }: IConfirmEmailtype): Promise<HUser | void> {
    let user: HUser | null = await this.authHelpers.checkUser({
      email,
    });
    if (!user) throw new exceptions.NotFoundException("User not found");

    const userOtpKey = this.authHelpers.getUserOTPKey(user?.id);
    await this.authHelpers.blockUser({ userId: user?.id, userOtpKey });

    const redisOtp = await services.cacheService.get({ key: userOtpKey });
    user.phoneNumber = security.decrypting(user.phoneNumber);

    if (redisOtp === otp) {
      user = await userRepo.findByIdAndUpdate({
        id: user._id,
        update: {
          $set: { confirmEmail: true },
        },
      });
      if (!user) throw new exceptions.NotFoundException("User not found");
      await services.cacheService.del({ key: [userOtpKey] });
      return user;
    } else return await this.authHelpers.wrongOtpHandler(user?.id);
  }

  // ---------------------- RESEND OTP -------------------------
  async resendOtp({ email, topic }: IResendOTPType): Promise<string> {
    const user = await userRepo.findByEmail({ email });
    if (!user) throw new exceptions.NotFoundException("User not found");

    switch (topic.toString()) {
      case enums.eventEnum.signup:
        const sendKey = this.authHelpers.getUserSendKey(user?.id);
        const otpKey = this.authHelpers.getUserOTPKey(user?.id);

        if (await services.cacheService.exists({ key: otpKey }))
          throw new exceptions.TooManyRequestException(
            "Can't send new OTP, try again later",
          );

        let count = Number(await services.cacheService.get({ key: sendKey }));
        if (count) {
          if (count === max_send_retries) {
            const remainingTime = await services.cacheService.ttl({
              key: sendKey,
            });
            throw new exceptions.TooManyRequestException(
              `You reached your limit, please try after ${
                remainingTime < 1 ? 0 : remainingTime / 60
              } minutes`,
            );
          } else await services.cacheService.incr({ key: sendKey });
        } else
          await services.cacheService.set({
            key: sendKey,
            value: 1,
            ttl: 600,
          });

        const otp = this.authHelpers.generateOtp();
        await services.cacheService.set({
          key: otpKey,
          value: otp,
          ttl: 5 * 60,
        });

        const userName = `${user?.firstName} ${user?.lastName}`;
        eventEmitter.emit(enums.eventEnum.signup, {
          recipients: { to: email },
          otp,
          name: userName,
        });
        break;

      default:
        break;
    }

    return `new OTP sent for ${topic}`;
  }

  // ---------------------- LOGIN ------------------------------
  async login({
    userData,
    issuer,
    FCMToken,
  }: ILoginType): Promise<IVerify2FAType | ICreateToken> {
    const { email, password } = userData;
    const user = await this.authHelpers.checkUser({ email });
    if (!user) throw new exceptions.NotFoundException("User not found");

    if (user?.banned)
      throw new exceptions.UnauthorizedException(
        "You got banned, please contact support",
      );

    try {
      await security.compare({
        plainText: password,
        cipherText: user?.password,
      });
    } catch (e: any) {
      await this.authHelpers.handleFailedLogin(user?.id);
    }

    await services.cacheService.del({
      key: [this.authHelpers.getUserLoginTriesKey(user?.id)],
    });

    if (user.twoFactorEnabled) {
      await this.authHelpers.blockUser({
        userId: user?.id,
        userOtpKey: this.authHelpers.getUserOTPKey(user?.id),
      });
      const otp = this.authHelpers.generateOtp();
      await services.cacheService.set({
        key: this.authHelpers.getUser2FAKey(user?.id),
        value: otp,
        ttl: 300,
      });
      eventEmitter.emit(enums.eventEnum.fa, {
        recipients: { to: email },
        name: user.firstName,
        otp,
      });
      return {
        message: "2FA OTP sent to your email",
        require2FA: true,
        userId: user?._id,
      };
    }
    await this.notificationService.sendNotificationToUser({
      userId: user?.id.toString(),
      title: "New login",
      body: "New device has loged in to your account",
    });
    const tokens = await this.authHelpers.verifyLogin({ issuer, user });
    if (FCMToken) {
      await this.notificationService.addFCM({
        userId: user?.id || user?._id.toString(),
        FCMToken,
      });
      // await this.send
    }
    return tokens;
  }

  // ---------------------- VERIFY 2FA -------------------------
  async verify2FALogin({ userId, otp, issuer }: IVerify2FALogin) {
    const user = await this.authHelpers.checkUser({
      id: userId,
    });
    if (!user) throw new exceptions.NotFoundException("User not found");

    const key = this.authHelpers.getUser2FAKey(userId);
    const redisOtp = await services.cacheService.get({ key });

    await this.authHelpers.blockUser({
      userId,
      userOtpKey: key,
    });

    if (!redisOtp)
      throw new exceptions.NotFoundException("OTP expired or not found");
    if (Number(redisOtp) != otp)
      return await this.authHelpers.wrongOtpHandler(userId);
    else {
      await services.cacheService.del({
        key: [key, this.authHelpers.getUserOtpTriesKey(userId)],
      });
      return await this.authHelpers.verifyLogin({ issuer, user });
    }
  }

  // ---------------------- VERIFY GOOGLE ID -------------------
  async verifyGoogleid(idToken: string): Promise<TokenPayload> {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: google_client_id,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new exceptions.BadRequestException("Payload is not defined");
    }
    if (!payload.email || !payload.email_verified) {
      throw new exceptions.BadRequestException("Email is not verified");
    }
    return payload;
  }

  // ---------------------- LOGIN WITH GOOGLE ------------------
  async loginWithGmail({
    idToken,
    issuer,
  }: ILoginWithGoogleType): Promise<ILoginWithGoogleReturnType> {
    const payload: TokenPayload = await this.verifyGoogleid(idToken);
    const { email, given_name, family_name, picture } = payload;
    let user = await userRepo.findByEmail({ email: email as string });
    if (user) {
      // login.
      const token = tokenService.createToken({
        userId: user.id,
        issuer,
      });
      eventEmitter.emit(enums.eventEnum.login, {
        recipients: { to: email },
        subject: "New login",
        text: `a new login detected at ${new Date()}, if it's not you please change the password`,
      });
      return { token, status: 200 };
    }

    // signup
    user = await userRepo.create({
      data: {
        email,
        firstName: given_name,
        lastName: family_name,
        image: picture,
        provider: enums.providerEnum.google,
        confirmEmail: true,
      },
    });

    const token = tokenService.createToken({
      userId: user.id,
      issuer,
      role: user.role,
    });
    return { token, status: 201 };
  }

  // ---------------------- LOGOUT -----------------------------
  async logout({ auth, type }: ILogoutType): Promise<void> {
    const [, token] = auth.split(" ") as [string, string];
    const rawToken = token || auth;

    switch (type) {
      case enums.logoutEnum.all:
        const data = jwt.decode(rawToken);
        if (!data) throw new exceptions.BadRequestException("jwt is not valid");
        if (typeof data.sub !== "string") {
          throw new exceptions.BadRequestException("Invalid user id data type");
        }
        const userId = data.sub;
        await userRepo.updateOne({
          filter: { _id: userId },
          // update time in seconds
          update: { credintialsChangedAt: Math.ceil(Date.now() / 1000) },
        });
        const arr = await services.cacheService.keys({
          prefix: tokenService.getPrefixRevoke(userId),
        });
        if (arr.length > 0) {
          // delete all revoked token
          await services.cacheService.del({ key: arr });
        }
        // remove cached user
        await services.cacheService.del({
          key: [this.authHelpers.getUserKey(userId)],
        });
        break;
      default:
        // create one revoked token
        await this.authHelpers.revokedToken(rawToken);
        break;
    }
  }

  // ---------------------- FORGET PASSWORD --------------------
  async forgetPassword(email: string): Promise<void> {
    const user = await this.authHelpers.checkUser({ email });
    if (!user) throw new exceptions.NotFoundException("User not found");
    await user?.updateOne({
      $set: { credintialsChangedAt: Math.ceil(Date.now() / 1000) },
    });
    const arr = await services.cacheService.keys({
      prefix: tokenService.getPrefixRevoke(user?._id),
    });
    arr.length && (await services.cacheService.del({ key: arr }));
    await this.authHelpers.createAndSendOtp({
      user,
      event: enums.eventEnum.forget,
    });
    return;
  }

  async resetPassword({
    email,
    otp,
    newPassword,
    cPassword,
  }: IForgetPasswordType): Promise<string | void> {
    const user = await this.authHelpers.checkUser({ email });
    if (!user) throw new exceptions.NotFoundException("User not found");
    if (newPassword !== cPassword)
      throw new exceptions.BadRequestException("Password dont't match");
    const userForgetKey = this.authHelpers.getUserOTPForgetKey(user?.id);
    await this.authHelpers.blockUser({
      userId: user?.id,
      userOtpKey: userForgetKey,
    });

    const redisOtp = await services.cacheService.get({
      key: userForgetKey,
    });
    // he didn't forget the password
    if (!redisOtp) throw new exceptions.NotFoundException("OTP not found");

    if (Number(redisOtp) == otp) {
      await user.updateOne({
        $set: {
          password: await security.hash(newPassword),
        },
      });
      return "Password changed";
    } else {
      return await this.authHelpers.wrongOtpHandler(user?.id);
    }
  }
}

export const authService = new AuthService();
