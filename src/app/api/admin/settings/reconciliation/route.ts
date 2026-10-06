import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const KEY = "order_reconciliation_stale_minutes";
const DEFAULT_MINUTES = 15;
const schema = z.object({ staleMinutes: z.coerce.number().int().min(5).max(1440) });

async function admin() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const setting = await db.appSetting.findUnique({ where: { key: KEY } });
  const staleMinutes = setting ? Number(setting.value) : DEFAULT_MINUTES;
  return NextResponse.json({ ok: true, staleMinutes: Number.isFinite(staleMinutes) ? staleMinutes : DEFAULT_MINUTES, defaultMinutes: DEFAULT_MINUTES, minMinutes: 5, maxMinutes: 1440 });
}

export async function POST(req: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "staleMinutes must be an integer between 5 and 1440" }, { status: 400 });

  const staleMinutes = parsed.data.staleMinutes;
  await db.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(staleMinutes) },
    update: { value: String(staleMinutes) }
  });

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "admin.setting.updated",
      resource: KEY,
      metadata: { staleMinutes }
    }
  });

  return NextResponse.json({ ok: true, staleMinutes });
}
