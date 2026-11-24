import bcrypt from "bcrypt";
import { BadRequestException } from "../exceptions/application.exception.js";
import { hash_salt } from "../../config/config.service.js";

// ---------------------- HASING -----------------------------
export const hash = async (plainText: string): Promise<string> => {
  return await bcrypt.hash(plainText, hash_salt);
};

// ---------------------- COMPARE ----------------------------
export const compare = async ({
  plainText,
  cipherText,
}: {
  plainText: string;
  cipherText: string;
}) => {
  const result = await bcrypt.compare(plainText, cipherText);
  if (!result) throw new BadRequestException("Invalid email or password");
};
