import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const token = () => randomBytes(32).toString('base64url');
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function hash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function matches(password: string, encoded: string) {
  const [salt, key] = encoded.split(':');
  return timingSafeEqual(await scrypt(password, salt, 64) as Buffer, Buffer.from(key, 'hex'));
}
