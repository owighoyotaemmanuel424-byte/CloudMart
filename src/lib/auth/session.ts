import crypto from "node:crypto";
import { db } from "@/lib/db";

const COOKIE = "cloudmart_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;
const MIN_SECRET_LENGTH = 32;

// Fail closed: a missing, short, or borrowed secret used to be tolerated, which
// made session cookies forgeable on any deployment that did not set
// CLOUDMART_SESSION_SECRET (the key fell back to a constant in this file).
function secret() {
  const value = process.env.CLOUDMART_SESSION_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `CLOUDMART_SESSION_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return value;
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

  const cost = Number(nRaw);
  const blockSize = Number(rRaw);
  const parallelization = Number(pRaw);
  // Bounds the work a stored hash can demand so a malformed or hostile row
  // cannot turn a login attempt into unbounded CPU/memory use.
  if (
    !Number.isInteger(cost) || cost < 1024 || cost > 1 << 20 ||
    !Number.isInteger(blockSize) || blockSize < 1 || blockSize > 32 ||
    !Number.isInteger(parallelization) || parallelization < 1 || parallelization > 16
  ) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
