import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, COOKIE, TTL_SECONDS, hashPassword } from "@/lib/auth/session";

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
  try {
    const input = schema.parse(await request.json());
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
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Registration failed",
    }, { status: 400 });
  }
}
