import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const providerConfigured = Boolean(process.env.GLOBALGLE_API_KEY);
  const provider = providerConfigured ? getProvider("globalgle") : null;
  const globalgle = provider ? await provider.health() : { ok: false, status: 0, message: "not_configured" };

  return NextResponse.json({
    ok: true,
    service: "cloudmart",
    timestamp: new Date().toISOString(),
    globalgle
  });
}
