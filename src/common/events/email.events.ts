import { EventEmitter } from "events";
import { sendMail } from "../services/mail.service.js";
import { eventEnum } from "../enum/index.js";
import {
  signupOtpTemplate,
  forgetPasswordOtpTemplate,
  twoFactorOtpTemplate,
} from "../templates/templates.js";

export const eventEmitter = new EventEmitter();

eventEmitter.on(
  eventEnum.signup,
  async ({
    recipients,
    name,
    otp,
  }: {
    recipients: {
      to: string;
      cc?: string;
      bc?: string;
    };
    name: string;
    otp: number;
  }) => {
    try {
      await sendMail({
        recipients,
        subject: `Welcome ${name}`,
        html: signupOtpTemplate({ name, otp }),
      });
    } catch (e: any) {
      throw e;
    }
  },
);

eventEmitter.on(eventEnum.login, async (payload) => {
  try {
    await sendMail(payload);
  } catch (e:any) {
    throw e;
  }
});

eventEmitter.on(
  eventEnum.forget,
  async ({
    recipients,
    name,
    otp,
  }: {
    recipients: {
      to: string;
      cc?: string;
      bc?: string;
    };
    name: string;
    otp: number;
  }) => {
    try {
      await sendMail({
        recipients,
        subject: "Reset your password",
        html: forgetPasswordOtpTemplate({ name, otp }),
      });
    } catch (e: any) {
      throw e;
    }
  },
);

eventEmitter.on(
  eventEnum.fa,
  async ({
    recipients,
    name,
    otp,
  }: {
    recipients: {
      to: string;
      cc?: string;
      bc?: string;
    };
    name: string;
    otp: number;
  }) => {
    try {
      await sendMail({
        recipients,
        subject: "2FA Verification Code",
        html: twoFactorOtpTemplate({ name, otp }),
      });
    } catch (e: any) {
      throw e;
    }
  },
);
