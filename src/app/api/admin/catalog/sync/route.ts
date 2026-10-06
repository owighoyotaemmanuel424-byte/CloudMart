import { NextResponse } from "next/server";
import { syncProviderCatalog } from "@/lib/providers/catalog-sync";

export async function POST() {
  try {
    const result = await syncProviderCatalog("globalgle");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Catalog sync failed" },
      { status: 502 },
    );
  }
}
