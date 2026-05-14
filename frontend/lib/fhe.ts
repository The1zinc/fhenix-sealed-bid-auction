import { ethers, type BrowserProvider } from "ethers";
import type { CofheClient, DecryptForTxResult } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { arbSepolia } from "@cofhe/sdk/chains";

export async function initCofheClient(provider: BrowserProvider) {
  const signer = await provider.getSigner();
  const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);
  const client = createCofheClient(
    createCofheConfig({
      environment: "web",
      supportedChains: [arbSepolia],
    }),
  );

  await client.connect(publicClient, walletClient);
  return client;
}

export async function decryptAuctionResult(
  client: CofheClient,
  bidCtHash: bigint | string,
  bidderCtHash: bigint | string,
): Promise<{ bidResult: DecryptForTxResult; bidderResult: DecryptForTxResult }> {
  const [bidResult, bidderResult] = await Promise.all([
    client.decryptForTx(bidCtHash).withoutPermit().execute(),
    client.decryptForTx(bidderCtHash).withoutPermit().execute(),
  ]);

  return { bidResult, bidderResult };
}

export function encryptBid(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Bid amount must be a positive whole number.");
  }

  return BigInt(value);
}

export function toBytes32Handle(handle: bigint | string) {
  return typeof handle === "bigint" ? ethers.toBeHex(handle, 32) : handle;
}

export function decryptedValueToAddress(value: bigint) {
  return ethers.getAddress(`0x${value.toString(16).padStart(40, "0")}`);
}
