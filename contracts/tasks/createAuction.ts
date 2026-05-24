import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";

function getBlindAuctionAddress(): string {
  const envAddress = process.env.BLIND_AUCTION_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (envAddress) {
    return envAddress;
  }

  const deploymentPath = path.resolve(__dirname, "../../frontend/lib/deployments.json");
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    if (deployment.address) {
      return deployment.address;
    }
  }

  throw new Error("Set BLIND_AUCTION_ADDRESS or run the deploy task first.");
}

const AUCTION_TYPES: Record<string, number> = {
  sealed: 0,
  "sealed-bid": 0,
  english: 1,
  dutch: 2,
};

function parseAuctionType(value: string): number {
  const parsed = AUCTION_TYPES[value.toLowerCase()];
  if (parsed === undefined) {
    throw new Error("Auction type must be one of: sealed, english, dutch.");
  }

  return parsed;
}

task("create-auction", "Create an auction")
  .addParam("duration", "Auction duration in seconds", undefined, types.int)
  .addOptionalParam("type", "Auction type: sealed, english, dutch", "sealed", types.string)
  .addOptionalParam("startPrice", "Minimum/opening price, or Dutch start price", 0, types.int)
  .addOptionalParam("reservePrice", "Dutch reserve price", 0, types.int)
  .setAction(async ({ duration, type, startPrice, reservePrice }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const address = getBlindAuctionAddress();
    const contract = await hre.ethers.getContractAt("BlindAuction", address, signer);

    const auctionType = parseAuctionType(type);
    const tx = await contract.createAuction(duration, auctionType, startPrice, reservePrice);
    const receipt = await tx.wait();

    let auctionId: bigint | undefined;
    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "AuctionCreated") {
          auctionId = parsed.args.auctionId as bigint;
          break;
        }
      } catch {
        // Ignore logs emitted by other contracts.
      }
    }

    if (auctionId === undefined) {
      auctionId = await contract.auctionCount();
    }

    console.log(`Created ${type} auction ${auctionId.toString()} in tx ${tx.hash}`);
  });
