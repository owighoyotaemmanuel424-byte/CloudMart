import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, COOKIE, TTL_SECONDS } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await db.user.upsert({
      where: { email: input.email.toLowerCase() },
      create: { email: input.email.toLowerCase(), name: input.name },
      update: { name: input.name },
    });
    const session = await createSession(user.id);
    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set(COOKIE, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: TTL_SECONDS, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Registration failed" }, { status: 400 });
  }
}
