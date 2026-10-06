import { NextResponse } from "next/server";
import { getLiveCatalogServices } from "@/lib/catalog/live-services";

export async function GET() {
  if (!process.env.GLOBALGLE_API_KEY) {
    return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 503 });
  }

  try {
    const services = await getLiveCatalogServices();

    return NextResponse.json({
      ok: true,
      provider: "globalgle",
      source: "live",
      count: services.length,
      services,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "provider_unavailable",
      source: "live",
      services: [],
    }, { status: 503 });
  }
}
