import { ethers, type BrowserProvider } from "ethers";

// Actual SDK modules are loaded lazily via dynamic import() so that the heavy
// tfhe WASM bundle is never pulled into the initial webpack compilation.
// This keeps the build fast and avoids Vercel Hobby timeouts.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type CofheClient = any;

export type DecryptForTxResult = {
  ctHash: bigint | string;
  decryptedValue: bigint;
  signature: string;
};

async function loadSdk() {
  const [{ createCofheClient, createCofheConfig }, { Ethers6Adapter }, { arbSepolia }] = await Promise.all([
    import("@cofhe/sdk/web"),
    import("@cofhe/sdk/adapters"),
    import("@cofhe/sdk/chains"),
  ]);
  return { createCofheClient, createCofheConfig, Ethers6Adapter, arbSepolia };
}

export async function initCofheClient(provider: BrowserProvider) {
  const { createCofheClient, createCofheConfig, Ethers6Adapter, arbSepolia } = await loadSdk();
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
  client: any,
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
