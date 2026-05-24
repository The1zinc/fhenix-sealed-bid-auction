import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const runtime = "edge";

// GET /api/bids?auction_id=<uuid> — list bids for an auction (newest first)
export async function GET(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json({ data: [], error: null });
  }

  try {
    const sql = getDb();
    const auctionId = req.nextUrl.searchParams.get("auction_id");

    if (!auctionId) {
      return NextResponse.json(
        { data: null, error: { message: "auction_id is required" } },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT * FROM bids
      WHERE auction_id = ${auctionId}
      ORDER BY placed_at DESC
    `;

    return NextResponse.json({ data: rows, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: { message: err?.message ?? "Database error" } },
      { status: 500 }
    );
  }
}

// POST /api/bids — insert a new bid record
export async function POST(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { data: null, error: { message: "Database not configured" } },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { auction_id, bidder_address, tx_hash } = body;

    const sql = getDb();
    const rows = await sql`
      INSERT INTO bids (auction_id, bidder_address, tx_hash)
      VALUES (${auction_id}, ${bidder_address}, ${tx_hash ?? null})
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0], error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: { message: err?.message ?? "Insert failed" } },
      { status: 500 }
    );
  }
}
