import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, COOKIE, hashPassword, TTL_SECONDS, verifyPassword } from "@/lib/auth/session";
import { clientIp, rateLimitAll, RATE_LIMIT_WINDOWS, tooManyRequests } from "@/lib/security/rate-limit";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const schema = z.object({
  email: z.string().email(),
  key: z.string().min(1).max(256),
  password: passwordSchema.optional(),
  mode: z.enum(["bootstrap", "login"]).default("login"),
});

function validKey(input: string) {
  const expected = process.env.CLOUDMART_ADMIN_ACCESS_KEY;
  if (!expected || input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_SECONDS,
    path: "/",
  });
  return response;
}

async function audit(action: string, actorId: string | null, metadata: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { actorId, action, resource: "admin_access", metadata } });
  } catch (error) {
    console.error("[cloudmart] admin audit write failed", error);
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimitAll([
    { key: "admin-access:global", limit: 60, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
    { key: `admin-access:ip:${ip}`, limit: 5, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
  ]);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid admin access request" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();

  const perAccount = rateLimitAll([
    { key: `admin-access:account:${email}`, limit: 5, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
  ]);
  if (!perAccount.ok) return tooManyRequests(perAccount);

  try {
    if (!validKey(input.key)) {
      await audit("admin.login_failed", null, { mode: input.mode, reason: "invalid_access_key" });
      return NextResponse.json({ ok: false, error: "Invalid admin credentials" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { email } });
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });

    if (input.mode === "bootstrap") {
      if (!input.password) {
        return NextResponse.json(
          { ok: false, error: "Choose a password for the admin account" },
          { status: 400 },
        );
      }

      const isFirstAdmin = adminCount === 0;
      const canClaimPassword = Boolean(user && user.role === "ADMIN" && !user.passwordHash);
      if (!isFirstAdmin && !canClaimPassword) {
        return NextResponse.json({ ok: false, error: "Admin bootstrap is already locked" }, { status: 409 });
      }

      const passwordHash = hashPassword(input.password);
      const admin = user
        ? await db.user.update({ where: { id: user.id }, data: { role: "ADMIN", passwordHash } })
        : await db.user.create({ data: { email, role: "ADMIN", passwordHash } });

      await audit("admin.login", admin.id, { mode: "bootstrap", claimed: canClaimPassword });
      return setSessionCookie(
        NextResponse.json({ ok: true, mode: "bootstrap", user: { id: admin.id, email: admin.email, role: admin.role } }),
        (await createSession(admin.id)).value,
      );
    }

    // Login requires both the deployment access key and the admin's own
    // password, so the shared key alone is no longer a master credential.
    const passwordOk = Boolean(input.password) && verifyPassword(input.password as string, user?.passwordHash);
    if (!user || user.role !== "ADMIN" || !user.passwordHash || !passwordOk) {
      await audit("admin.login_failed", null, { mode: "login", reason: "invalid_credentials" });
      return NextResponse.json({ ok: false, error: "Invalid admin credentials" }, { status: 401 });
    }

    await audit("admin.login", user.id, { mode: "login" });
    return setSessionCookie(
      NextResponse.json({ ok: true, mode: "login", user: { id: user.id, email: user.email, role: user.role } }),
      (await createSession(user.id)).value,
    );
  } catch (error) {
    console.error("[cloudmart] admin access failed", error);
    return NextResponse.json({ ok: false, error: "Unable to complete admin access" }, { status: 500 });
  }
}
