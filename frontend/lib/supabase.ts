import { createClient } from "@supabase/supabase-js";

export type AuctionRow = {
  id: string;
  contract_auction_id: number;
  seller_address: string;
  title: string;
  description: string | null;
  image_url: string | null;
  end_time: string;
  is_closed: boolean | null;
  is_settled: boolean | null;
  winning_bidder: string | null;
  winning_bid_display: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AuctionInsert = {
  contract_auction_id: number;
  seller_address: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  end_time: string;
  is_closed?: boolean;
  is_settled?: boolean;
  winning_bidder?: string | null;
  winning_bid_display?: string | null;
};

export type AuctionUpdate = Partial<
  Pick<AuctionRow, "is_closed" | "is_settled" | "winning_bidder" | "winning_bid_display" | "updated_at">
>;

export type BidRow = {
  id: string;
  auction_id: string | null;
  bidder_address: string;
  tx_hash: string | null;
  placed_at: string | null;
};

export type BidInsert = {
  auction_id: string;
  bidder_address: string;
  tx_hash?: string | null;
};

type Database = {
  public: {
    Tables: {
      auctions: {
        Row: AuctionRow;
        Insert: AuctionInsert;
        Update: AuctionUpdate;
        Relationships: [];
      };
      bids: {
        Row: BidRow;
        Insert: BidInsert;
        Update: Partial<BidRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
