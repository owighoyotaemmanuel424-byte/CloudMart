import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.GLOBALGLE_API_KEY) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  }

  return NextResponse.json(await getProvider("globalgle").balance());
}
