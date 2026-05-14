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

task("place-bid", "Place a plaintext bid that is encrypted on-chain")
  .addParam("auctionId", "Contract auction id", undefined, types.string)
  .addParam("amount", "Bid amount in auction units", undefined, types.string)
  .setAction(async ({ auctionId, amount }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const address = getBlindAuctionAddress();
    const contract = await hre.ethers.getContractAt("BlindAuction", address, signer);

    const tx = await contract.placeBid(auctionId, amount);
    await tx.wait();

    console.log(`Placed bid for auction ${auctionId} in tx ${tx.hash}`);
  });
