import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const [services, products] = await Promise.all([
    db.service.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, category: true, enabled: true, updatedAt: true } }),
    db.providerProduct.findMany({ orderBy: { name: "asc" }, select: { id: true, provider: true, externalSlug: true, name: true, category: true, enabled: true, serviceId: true, updatedAt: true } }),
  ]);
  return NextResponse.json({ ok: true, services, products });
}
