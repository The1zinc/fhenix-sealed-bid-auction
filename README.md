# Sealed-Bid Confidential Auction dApp

Confidential multi-auction dApp for Arbitrum Sepolia using Solidity, Hardhat, Next.js 14, Tailwind CSS, Supabase metadata, and Fhenix CoFHE.

Buyers submit plaintext bid amounts to the contract. The contract immediately converts each bid to `euint64`, compares encrypted bids with CoFHE, and stores only encrypted highest-bid state until the seller closes the auction and a proof-backed reveal transaction settles the final result.

## Prerequisites

- Node.js 20+
- pnpm 9+
- MetaMask
- Arbitrum Sepolia ETH from a faucet, for example `https://www.alchemy.com/faucets/arbitrum-sepolia`
- Supabase free-tier project

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `database.sql` from the repository root.
4. Copy the project URL and anon key into `frontend/.env.local` using `frontend/.env.local.example` as the template.

The database stores auction metadata and bid transaction metadata only. Bid amounts are never stored in Supabase.

## Contract Setup

```bash
cd contracts
pnpm install
pnpm compile
pnpm test
```

Create `contracts/.env` from `contracts/.env.example`:

```bash
PRIVATE_KEY=your_wallet_private_key_here
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BLIND_AUCTION_ADDRESS=0x_deployed_contract_address_here
```

## Deploy To Arbitrum Sepolia

```bash
cd contracts
pnpm deploy:testnet
```

The deploy script writes the deployed address and ABI to `frontend/lib/deployments.json`. Copy the deployed address into `frontend/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Frontend Setup

```bash
cd frontend
pnpm install
pnpm dev
```

Create `frontend/.env.local` from `frontend/.env.local.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_CONTRACT_ADDRESS=0x_deployed_contract_address_here
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
```

## End-To-End Flow

1. Open the frontend and connect MetaMask on Arbitrum Sepolia.
2. Create an auction from `/create`; the contract emits `AuctionCreated`, and Supabase stores only metadata.
3. Open the auction page and place bids; the contract encrypts each plaintext bid on-chain with `FHE.asEuint64` and updates encrypted highest-bid state with `FHE.gt`, `FHE.max`, and `FHE.select`.
4. The seller closes the auction from the detail page or with `pnpm hardhat close-auction --auction-id <id> --network arbSepolia`; the contract calls `FHE.allowPublic` on the highest bid and bidder handles.
5. Reveal the winner from the detail page or with `pnpm hardhat reveal-winner --auction-id <id> --network arbSepolia`; the CoFHE SDK runs `decryptForTx(handle).withoutPermit().execute()` off-chain, and `revealWinner` publishes signed decrypt results on-chain.

## Hardhat Tasks

```bash
pnpm hardhat create-auction --duration 3600 --network arbSepolia
pnpm hardhat place-bid --auction-id 1 --amount 100 --network arbSepolia
pnpm hardhat close-auction --auction-id 1 --network arbSepolia
pnpm hardhat reveal-winner --auction-id 1 --network arbSepolia
```

`BLIND_AUCTION_ADDRESS` must be set in `contracts/.env` for task usage after deployment.

## Network

- Target chain: Arbitrum Sepolia
- Chain ID: `421614`
- RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`

## Privacy Notes

- Bid amounts enter the transaction as plaintext integers and are encrypted by the contract with CoFHE.
- The contract stores encrypted `euint64 highestBid` and encrypted `eaddress highestBidder` until settlement.
- Supabase stores only metadata: auction details, bidder addresses, and transaction hashes.
- The winning amount and winner address are written to Supabase only after on-chain reveal.
