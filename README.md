# Confidential Auction dApp

Multi-auction dApp for Arbitrum Sepolia using Solidity, Hardhat, Next.js 14, Tailwind CSS, Supabase metadata, and Fhenix CoFHE.

The contract supports sealed-bid, English, and Dutch auctions. Sealed-bid auctions keep the highest bid and bidder in CoFHE encrypted state until the auction ends; anyone can publish the encrypted result handles after `endTime`, and anyone can submit the CoFHE decrypt results to finalize the winner.

## Prerequisites

- Node.js 20+
- pnpm 9+
- MetaMask
- Arbitrum Sepolia ETH
- Supabase free-tier project

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `database.sql` from the repository root.
4. Copy the project URL and anon key into `frontend/.env.local` using `frontend/.env.local.example`.

Supabase stores auction metadata and bid transaction metadata only. Auction status, result, and bid comparison state live in the contract.

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

The frontend also has `/deploy`, which can deploy the compiled contract from MetaMask and persist the address in browser local storage.

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

## Vercel Hobby Deployment

Use a Vercel project rooted at `frontend`, not the repository root. Keep the default Next.js build settings:

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: leave as the Next.js default

Set these environment variables in Vercel before deploying:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CHAIN_ID=421614`
- `NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc`

Do not commit `.env`, `.env.local`, private keys, build output, or TypeScript cache files. For GitHub Free, use a public repository if you want unlimited standard GitHub-hosted Actions minutes; private repositories have monthly included minutes and artifact storage limits.

## Auction Flow

1. Open the frontend and connect MetaMask on Arbitrum Sepolia.
2. Create a sealed-bid, English, or Dutch auction from the Create Auction tab or `/create`.
3. Bids are sent to `placeBid`.
   - Sealed-bid: the contract converts the bid to `euint64` and updates encrypted highest-bid state.
   - English: the contract tracks the public ascending highest bid.
   - Dutch: the first bid meeting the current descending price finalizes the auction immediately.
4. After `endTime`, anyone can call `finalizeAuction`.
   - Sealed-bid: encrypted winner/bid handles are made public for CoFHE reveal.
   - English/Dutch: public result state is finalized.
5. For sealed-bid auctions, anyone can call `revealWinner` with CoFHE decrypt results and signatures.

## Hardhat Tasks

```bash
pnpm hardhat create-auction --duration 3600 --type sealed --start-price 1 --network arbSepolia
pnpm hardhat create-auction --duration 3600 --type english --start-price 100 --network arbSepolia
pnpm hardhat create-auction --duration 3600 --type dutch --start-price 1000 --reserve-price 200 --network arbSepolia
pnpm hardhat place-bid --auction-id 1 --amount 100 --network arbSepolia
pnpm hardhat finalize-auction --auction-id 1 --network arbSepolia
pnpm hardhat reveal-winner --auction-id 1 --network arbSepolia
```

`BLIND_AUCTION_ADDRESS` must be set in `contracts/.env` for task usage after deployment.

## Network

- Target chain: Arbitrum Sepolia
- Chain ID: `421614`
- RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`

## Privacy Notes

- Bid amounts currently enter transactions as plaintext integers and are converted to CoFHE handles by the contract.
- Sealed-bid auctions store encrypted `euint64 highestBid` and encrypted `eaddress highestBidder` until finalization publishes handles.
- Supabase stores metadata: auction details, bidder addresses, and transaction hashes.
- `verifyDecryptionProofPlaceholder` marks the future integration point for a ZK proof verifier around correct decryption.
