import type { App } from "firebase-admin";
import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { readFileSync } from "fs";
import { resolve } from "path";
import { cacheService, type CacheService } from "./cache.service.js";
import { AuthHelpers, authHelpers } from "../../modules/auth/auth.helper.js";

const fileData = JSON.parse(
  readFileSync(resolve("firebase.json"), { encoding: "utf-8" }),
);

export class NotificationService {
  private app: App;
  private messaging: Messaging;
  private readonly cacheService: CacheService;
  private readonly authHelpers: AuthHelpers;
  constructor() {
    this.app = initializeApp({
      credential: cert(fileData),
    });
    this.messaging = getMessaging(this.app);
    this.cacheService = cacheService;
    this.authHelpers = authHelpers;
  }

  async sendNotification({
    token,
    title,
    body,
  }: {
    token: string;
    title: string;
    body: string;
  }): Promise<string> {
    return await this.messaging.send({
      token,
      notification: {
        title,
        body,
      },
    });
  }

  async sendNotificationToUser({
    userId,
    title,
    body,
  }: {
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    try {
      const tokens = await this.getFCMs({ userId });
      if (tokens?.length) {
        await this.sendNotifications({
          tokens,
          title,
          body,
        });
      }
    } catch (e) {
      throw e;
    }
  }

  async sendNotifications({
    tokens,
    title,
    body,
  }: {
    tokens: string[];
    title: string;
    body: string;
  }) {
    const messages = tokens.map((token) => {
      return {
        token,
        notification: {
          title,
          body,
        },
      };
    });
    return await this.messaging.sendEach(messages);
  }

  getUserFCMToken = (userId: string): string =>
    `FCM::token::${this.authHelpers.getUserKey(userId)}`;

  async addFCM({
    userId,
    FCMToken,
  }: {
    userId: string;
    FCMToken: string;
  }): Promise<number> {
    const key = this.getUserFCMToken(userId);
    return await this.cacheService.sAdd({
      key,
      value: FCMToken,
    });
  }

  async removeFCM({
    userId,
    FCMToken,
  }: {
    userId: string;
    FCMToken: string;
  }): Promise<number> {
    const key = this.getUserFCMToken(userId);
    return await this.cacheService.sRem({
      key,
      value: FCMToken,
    });
  }

  async getFCMs({ userId }: { userId: string }): Promise<string[]> {
    const key = this.getUserFCMToken(userId);
    return await this.cacheService.sMem({
      key,
    });
  }
}

export const notificationService = new NotificationService();
