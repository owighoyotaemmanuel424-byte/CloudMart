import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, COOKIE, TTL_SECONDS, verifyPassword } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await db.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
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
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sign in",
    }, { status: 400 });
  }
}
