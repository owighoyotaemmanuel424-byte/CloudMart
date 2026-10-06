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
