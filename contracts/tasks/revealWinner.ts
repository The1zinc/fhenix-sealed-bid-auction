import { task, types } from "hardhat/config";
import { ethers } from "ethers";
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

function toBytes32Handle(handle: bigint | string): string {
  return typeof handle === "bigint" ? ethers.toBeHex(handle, 32) : handle;
}

function bigintToAddress(value: bigint): string {
  return ethers.getAddress(`0x${value.toString(16).padStart(40, "0")}`);
}

async function createCofheClient(hre: any, signer: any) {
  const pluginFactory = hre.cofhe?.createClientWithBatteries;
  if (typeof pluginFactory === "function") {
    return pluginFactory(signer);
  }

  const [{ createCofheClient, createCofheConfig }, { HardhatSignerAdapter }, chains] = await Promise.all([
    import("@cofhe/sdk/node"),
    import("@cofhe/sdk/adapters"),
    import("@cofhe/sdk/chains"),
  ]);

  const { publicClient, walletClient } = await HardhatSignerAdapter(signer);
  const client = createCofheClient(
    createCofheConfig({
      environment: hre.network.name === "hardhat" ? "hardhat" : "node",
      supportedChains: [chains.arbSepolia, chains.hardhat],
    }),
  );

  await client.connect(publicClient, walletClient);
  return client;
}

task("reveal-winner", "Decrypt public auction handles and settle the winner")
  .addParam("auctionId", "Contract auction id", undefined, types.string)
  .setAction(async ({ auctionId }, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const address = getBlindAuctionAddress();
    const contract = await hre.ethers.getContractAt("BlindAuction", address, signer);
    const client = await createCofheClient(hre, signer);

    const bidCtHash = await contract.getHighestBidHandle(auctionId);
    const bidderCtHash = await contract.getHighestBidderHandle(auctionId);

    const bidResult = await client.decryptForTx(bidCtHash).withoutPermit().execute();
    const bidderResult = await client.decryptForTx(bidderCtHash).withoutPermit().execute();
    const winner = bigintToAddress(bidderResult.decryptedValue);

    const tx = await contract.revealWinner(
      auctionId,
      toBytes32Handle(bidResult.ctHash),
      bidResult.decryptedValue,
      bidResult.signature,
      toBytes32Handle(bidderResult.ctHash),
      winner,
      bidderResult.signature,
    );
    await tx.wait();

    console.log(`Winner: ${winner}`);
    console.log(`Winning amount: ${bidResult.decryptedValue.toString()}`);
    console.log(`Reveal tx: ${tx.hash}`);
  });
