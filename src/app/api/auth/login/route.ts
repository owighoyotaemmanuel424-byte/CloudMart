import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, COOKIE, hashPassword, TTL_SECONDS, verifyPassword } from "@/lib/auth/session";
import { clientIp, rateLimitAll, RATE_LIMIT_WINDOWS, tooManyRequests } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const INVALID = { ok: false, error: "Invalid email or password." } as const;

// A missing account must cost the same as a wrong password, otherwise response
// timing reveals which emails are registered.
let timingEqualizerHash: string | null = null;
function equalizeTiming(password: string) {
  timingEqualizerHash ??= hashPassword("cloudmart-timing-equalizer");
  verifyPassword(password, timingEqualizerHash);
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimitAll([
    { key: "login:global", limit: 300, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
    { key: `login:ip:${ip}`, limit: 30, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
  ]);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(INVALID, { status: 401 });

  const email = parsed.data.email.toLowerCase();
  const perAccount = rateLimitAll([
    { key: `login:account:${email}`, limit: 10, windowMs: RATE_LIMIT_WINDOWS.quarterHour },
  ]);
  if (!perAccount.ok) return tooManyRequests(perAccount);

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      equalizeTiming(parsed.data.password);
      return NextResponse.json(INVALID, { status: 401 });
    }

    if (!verifyPassword(parsed.data.password, user.passwordHash)) {
      return NextResponse.json(INVALID, { status: 401 });
    }

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
    // Server-side detail only; never echoed to the caller.
    console.error("[cloudmart] sign in failed", error);
    return NextResponse.json({ ok: false, error: "Unable to sign in." }, { status: 500 });
  }
}
