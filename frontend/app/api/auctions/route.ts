import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const runtime = "edge";

// GET /api/auctions  — list all auctions (newest first)
// GET /api/auctions?id=<uuid> — get a single auction
export async function GET(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json({ data: [], error: null });
  }

  try {
    const sql = getDb();
    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const rows = await sql`SELECT * FROM auctions WHERE id = ${id} LIMIT 1`;
      if (rows.length === 0) {
        return NextResponse.json(
          { data: null, error: { message: "Auction not found" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ data: rows[0], error: null });
    }

    const rows = await sql`SELECT * FROM auctions ORDER BY created_at DESC`;
    return NextResponse.json({ data: rows, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: { message: err?.message ?? "Database error" } },
      { status: 500 }
    );
  }
}

// POST /api/auctions  — insert a new auction
export async function POST(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { data: null, error: { message: "Database not configured" } },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const {
      contract_auction_id,
      seller_address,
      auction_type,
      title,
      description,
      image_url,
      start_price,
      reserve_price,
      token_unit,
      end_time,
    } = body;

    const sql = getDb();
    const rows = await sql`
      INSERT INTO auctions (
        contract_auction_id, seller_address, auction_type, title,
        description, image_url, start_price, reserve_price, token_unit, end_time
      ) VALUES (
        ${contract_auction_id}, ${seller_address}, ${auction_type}, ${title},
        ${description ?? null}, ${image_url ?? null},
        ${start_price ?? 0}, ${reserve_price ?? 0}, ${token_unit ?? 'USDC'}, ${end_time}
      )
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
