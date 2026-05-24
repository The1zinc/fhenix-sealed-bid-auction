import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({ configured: isDbConfigured });
}
