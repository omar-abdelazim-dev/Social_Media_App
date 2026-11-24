import crypto from "node:crypto";
import { enc_algo, key, iv_length } from "../../config/config.service.js";

const algorithm = enc_algo;
const BufferedKey = Buffer.from(key, "hex");

// ---------------------- ENCRYPTING -------------------------
export const encrypting = (plainText: string): string => {
  const iv = crypto.randomBytes(iv_length);
  const cipher = crypto.createCipheriv(algorithm, BufferedKey, iv);
  let encrypted = cipher.update(plainText, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}::${encrypted}`;
};

// ---------------------- DECRYPTING -------------------------
export const decrypting = (cipherText: string): string => {
  let [iv, cipher] = cipherText.split("::") as [
    string | Buffer<ArrayBuffer>,
    string,
  ];
  iv = Buffer.from(iv as string, "hex");
  const plainText = crypto.createDecipheriv(algorithm, BufferedKey, iv);
  let decrypted = plainText.update(cipher, "hex", "utf-8");
  decrypted += plainText.final("utf-8");
  return decrypted;
};
