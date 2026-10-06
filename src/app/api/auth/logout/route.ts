import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
