import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const provider = getProvider("globalgle");
  const [health, balance] = await Promise.all([provider.health(), provider.balance().catch(() => null)]);
  return NextResponse.json({ ok: true, provider: "globalgle", health, balance });
}
