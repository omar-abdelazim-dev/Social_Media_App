import { config } from "dotenv";
import fs from "fs";

const envFile: string = `.env.${process.env.NODE_ENV}`;
const envFilePath: string =
  process.env.NODE_ENV && fs.existsSync(envFile) ? envFile : ".env";

config({ path: envFilePath });

export const port: number = Number(process.env.PORT),
  origins: string[] = process.env.ORIGINS?.split(",")!,
  rate_limit_max_count: string = process.env.RATE_LIMIT_MAX_COUNT!,
  db_uri: string = process.env.DB_URI!,
  redis_uri: string = process.env.REDIS_URI!,
  admin_refresh_secret_key: string = process.env.ADMIN_REFRESH_SECRET_KEY!,
  admin_access_secret_key: string = process.env.ADMIN_ACCESS_SECRET_KEY!,
  user_refresh_secret_key: string = process.env.USER_REFRESH_SECRET_KEY!,
  user_access_secret_key: string = process.env.USER_ACCESS_SECRET_KEY!,
  refresh_ex: number = Number(process.env.REFRESH_EX),
  access_ex: number = Number(process.env.ACCESS_EX),
  hash_salt: number = Number(process.env.HASH_SALT)!,
  enc_algo: string = process.env.ENC_ALGO!,
  key: string = process.env.KEY!,
  iv_length: number = Number(process.env.IV_LENGTH),
  google_client_id: string = process.env.GOOGLE_CLIENT_ID!,
  google_client_secret: string = process.env.GOOGLE_CLIENT_SECRET!,
  aws_access_key_id: string = process.env.AWS_ACCESS_KEY_ID!,
  aws_secret_access_key: string = process.env.AWS_SECRET_ACCESS_KEY!,
  aws_region: string = process.env.AWS_REGION!,
  aws_bucket_name: string = process.env.AWS_BUCKET_NAME!,
  image_upload_max_count: string = process.env.IMAGE_UPLOAD_MAX_COUNT!,
  app_email: string = process.env.APP_EMAIL!,
  app_password: string = process.env.APP_PASSWORD!,
  max_send_retries: number = Number(process.env.MAX_SEND_RETRIES!),
  max_retries: number = Number(process.env.MAX_RETRIES)!;
