import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  if (isDbConfigured) {
    try {
      const sql = getDb();
      await sql`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS token_unit VARCHAR(50) DEFAULT 'USDC'`;
    } catch (err: any) {
      console.error("Failed to run token_unit migration:", err?.message);
    }
  }
  return NextResponse.json({ configured: isDbConfigured });
}
