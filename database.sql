-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auctions: off-chain metadata only. Bid amounts are NEVER stored here.
CREATE TABLE auctions (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contract_auction_id INTEGER NOT NULL UNIQUE,
    seller_address      TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    image_url           TEXT,
    end_time            TIMESTAMP WITH TIME ZONE NOT NULL,
    is_closed           BOOLEAN DEFAULT FALSE,
    is_settled          BOOLEAN DEFAULT FALSE,
    winning_bidder      TEXT,     -- populated after on-chain reveal
    winning_bid_display TEXT,     -- human-readable amount after reveal (no raw amounts)
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bids: records that a wallet placed a bid. Amounts are NEVER stored.
CREATE TABLE bids (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id          UUID REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_address      TEXT NOT NULL,
    tx_hash             TEXT,
    placed_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by contract ID
CREATE INDEX idx_auctions_contract_id ON auctions(contract_auction_id);
CREATE INDEX idx_bids_auction_id      ON bids(auction_id);
CREATE INDEX idx_bids_bidder          ON bids(bidder_address);

-- Row Level Security (enable for production)
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids     ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Allow public read on auctions" ON auctions FOR SELECT USING (true);
CREATE POLICY "Allow public read on bids"     ON bids     FOR SELECT USING (true);

-- Authenticated insert/update policy
CREATE POLICY "Allow auth insert on auctions" ON auctions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow auth insert on bids"     ON bids     FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow auth update on auctions" ON auctions FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
