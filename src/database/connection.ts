import dns from "node:dns";
import mongoose from "mongoose";
import { db_uri } from "../config/config.service.js";
import { redisConnection } from "./redis.connection.js";

export default async () => {
  if (!db_uri) {
    throw new Error("DB_URI is missing");
  }
  await mongoose.connect(db_uri);
  console.info(`DB connected: ${mongoose.connection.name}`);
  await redisConnection();
};

dns.setServers(["1.1.1.1", "8.8.8.8"]);
