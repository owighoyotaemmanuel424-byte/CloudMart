import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  if (!process.env.GLOBALGLE_API_KEY) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  }
  const catalog = await getProvider("globalgle").catalog();
  return NextResponse.json({ provider: "globalgle", services: catalog });
}
