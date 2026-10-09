import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, COOKIE, hashPassword, TTL_SECONDS } from "@/lib/auth/session";
import { clientIp, rateLimitAll, RATE_LIMIT_WINDOWS, tooManyRequests } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimitAll([
    { key: "register:global", limit: 200, windowMs: RATE_LIMIT_WINDOWS.hour },
    { key: `register:ip:${ip}`, limit: 10, windowMs: RATE_LIMIT_WINDOWS.hour },
  ]);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid registration details" },
      { status: 400 },
    );
  }

  try {
    const input = parsed.data;
    const email = input.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({
        ok: false,
        error: "An account with this email already exists. Sign in instead.",
      }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: hashPassword(input.password),
      },
    });

    const session = await createSession(user.id);
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set(COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TTL_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[cloudmart] registration failed", error);
    return NextResponse.json({ ok: false, error: "Unable to create this account." }, { status: 500 });
  }
}
