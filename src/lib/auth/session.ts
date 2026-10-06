import crypto from "node:crypto";
import { db } from "@/lib/db";

const COOKIE = "cloudmart_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.CLOUDMART_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("CLOUDMART_SESSION_SECRET is required in production");
  }
  return value || process.env.GLOBALGLE_WEBHOOK_SECRET || "development-only-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export async function createSession(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${userId}.${expires}`;
  return { value: `${payload}.${sign(payload)}`, expires };
}

export async function getSessionUser(value?: string | null) {
  if (!value) return null;
  const [userId, expiresRaw, signature] = value.split(".");
  const expires = Number(expiresRaw);
  if (!userId || !expires || !signature || expires < Math.floor(Date.now() / 1000)) return null;
  const expected = sign(`${userId}.${expires}`);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
}

export { COOKIE, TTL_SECONDS };


const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded) return false;
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;

  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  if (!salt.length || !expected.length) return false;

  const actual = crypto.scryptSync(password, salt, expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: 32 * 1024 * 1024,
  });

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
