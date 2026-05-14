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

task("create-auction", "Create a sealed-bid auction")
  .addParam("duration", "Auction duration in seconds", undefined, types.int)
  .setAction(async ({ duration }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const address = getBlindAuctionAddress();
    const contract = await hre.ethers.getContractAt("BlindAuction", address, signer);

    const tx = await contract.createAuction(duration);
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

    console.log(`Created auction ${auctionId.toString()} in tx ${tx.hash}`);
  });
