import { createClient, type RedisClientType } from "redis";
import { redis_uri } from "../../config/config.service.js";

export class CacheService {
  private readonly client: RedisClientType;
  constructor() {
    this.client = createClient({
      url: redis_uri,
    });
    this.connect();
  }

  async connect() {
    try {
      this.client.connect();
      console.log("Redis connected");
    } catch (e) {
      console.log("Redis connection failed");
      throw e;
    }
  }

  async set({
    key,
    value,
    ttl,
  }: {
    key: string;
    value: any;
    ttl?: number;
  }): Promise<string | null> {
    if (typeof value !== "string") value = JSON.stringify(value);
    return await this.client.set(key, value, { ...(ttl ? { EX: ttl } : {}) });
  }

  async sAdd({ key, value }: { key: string; value: string }): Promise<number> {
    if (typeof value !== "string") value = JSON.stringify(value);
    return await this.client.sAdd(key, value);
  }

  async sRem({ key, value }: { key: string; value: string }): Promise<number> {
    if (typeof value !== "string") value = JSON.stringify(value);
    return await this.client.sRem(key, value);
  }

  async sMem({ key }: { key: string }): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  async get<T = string>({ key }: { key: string }): Promise<T | null> {
    const data: string | null = await this.client.get(key);
    let result;
    try {
      result = JSON.parse(data!);
    } catch (error) {
      result = data;
    }
    return result as T | null;
  }

  async exists({ key }: { key: string }): Promise<number> {
    return await this.client.exists(key);
  }

  async del({ key }: { key: string[] }): Promise<number> {
    // accept single key and arrays
    return await this.client.del(key);
  }

  async ttl({ key }: { key: string }): Promise<number> {
    return await this.client.ttl(key);
  }

  async keys({ prefix }: { prefix: string }): Promise<string[]> {
    return await this.client.keys(`${prefix}*`);
  }

  async incr({ key }: { key: string }): Promise<number> {
    return await this.client.incr(key);
  }
}

export const cacheService = new CacheService();
