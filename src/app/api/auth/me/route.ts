import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  return NextResponse.json({ authenticated: Boolean(user), user });
}
