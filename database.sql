-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auctions: off-chain metadata only. Auction state and results are read from the contract.
CREATE TABLE auctions (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contract_auction_id INTEGER NOT NULL UNIQUE,
    seller_address      TEXT NOT NULL,
    auction_type        TEXT NOT NULL DEFAULT 'sealed',
    title               TEXT NOT NULL,
    description         TEXT,
    image_url           TEXT,
    start_price         BIGINT DEFAULT 0,
    reserve_price       BIGINT DEFAULT 0,
    end_time            TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT auctions_type_check CHECK (auction_type IN ('sealed', 'english', 'dutch'))
);

-- Bids: records that a wallet placed a bid. Amounts are never stored here.
CREATE TABLE bids (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id          UUID REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_address      TEXT NOT NULL,
    tx_hash             TEXT,
    placed_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auctions_contract_id ON auctions(contract_auction_id);
CREATE INDEX idx_auctions_type        ON auctions(auction_type);
CREATE INDEX idx_bids_auction_id      ON bids(auction_id);
CREATE INDEX idx_bids_bidder          ON bids(bidder_address);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on auctions" ON auctions FOR SELECT USING (true);
CREATE POLICY "Allow public read on bids"     ON bids     FOR SELECT USING (true);

CREATE POLICY "Allow anon insert on auctions" ON auctions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow anon insert on bids"     ON bids     FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow anon metadata update on auctions" ON auctions FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
