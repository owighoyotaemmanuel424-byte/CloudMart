import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { createSession, COOKIE, TTL_SECONDS } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  key: z.string().min(1).max(256),
  mode: z.enum(["bootstrap", "login"]).default("login"),
});

function validKey(input: string) {
  const expected = process.env.CLOUDMART_ADMIN_ACCESS_KEY;
  if (!expected || input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!validKey(input.key)) {
      return NextResponse.json({ ok: false, error: "Invalid admin access key" }, { status: 401 });
    }

    const email = input.email.toLowerCase();
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });

    if (input.mode === "bootstrap") {
      if (adminCount > 0) {
        return NextResponse.json({ ok: false, error: "Admin bootstrap is already locked" }, { status: 409 });
      }

      const user = await db.user.upsert({
        where: { email },
        create: { email, role: "ADMIN" },
        update: { role: "ADMIN" },
      });
      const session = await createSession(user.id);
      await db.auditLog.create({ data: { actorId: user.id, action: "admin.login", resource: "admin_access", metadata: { mode: "bootstrap" } } });
      const response = NextResponse.json({ ok: true, mode: "bootstrap", user: { id: user.id, email: user.email, role: user.role } });
      response.cookies.set(COOKIE, session.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: TTL_SECONDS,
        path: "/",
      });
      return response;
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin account not found" }, { status: 403 });
    }

    const session = await createSession(user.id);
    await db.auditLog.create({ data: { actorId: user.id, action: "admin.login", resource: "admin_access", metadata: { mode: "login" } } });
    const response = NextResponse.json({ ok: true, mode: "login", user: { id: user.id, email: user.email, role: user.role } });
    response.cookies.set(COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TTL_SECONDS,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Admin access failed" }, { status: 400 });
  }
}
