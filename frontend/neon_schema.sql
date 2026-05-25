-- SQL Schema to initialize your Neon Postgres database
-- Copy and paste this into the SQL Editor in your Neon console (https://console.neon.tech)

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS auctions CASCADE;

-- Create auctions table with text primary key (automatically generating UUID string)
CREATE TABLE auctions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contract_auction_id INTEGER NOT NULL,
  seller_address VARCHAR(255) NOT NULL,
  auction_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  start_price NUMERIC DEFAULT 0,
  reserve_price NUMERIC DEFAULT 0,
  token_unit VARCHAR(50) NOT NULL DEFAULT 'USDC',
  end_time VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bids table referencing auctions
CREATE TABLE bids (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auction_id TEXT REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_address VARCHAR(255) NOT NULL,
  tx_hash VARCHAR(255),
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Index on contract_auction_id and seller_address for quick queries
CREATE INDEX idx_auctions_contract_id ON auctions(contract_auction_id);
CREATE INDEX idx_auctions_seller ON auctions(seller_address);
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
