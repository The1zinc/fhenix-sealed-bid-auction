import { Contract, isAddress, type ContractRunner, type InterfaceAbi } from "ethers";
import deployments from "./deployments.json";
import type { AuctionTypeSlug } from "./supabase";

type Deployment = {
  address?: string;
  abi?: unknown[];
};

export type ContractAuctionStatus = "active" | "ended" | "finalized";

export const AUCTION_TYPES: Record<AuctionTypeSlug, number> = {
  sealed: 0,
  english: 1,
  dutch: 2,
};

export const AUCTION_TYPE_LABELS: Record<AuctionTypeSlug, string> = {
  sealed: "Sealed-Bid",
  english: "English",
  dutch: "Dutch",
};

export const AUCTION_STATUS_LABELS: Record<ContractAuctionStatus, string> = {
  active: "Active",
  ended: "Ended",
  finalized: "Finalized",
};

const deployment = deployments as Deployment;

const STATIC_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || deployment.address || "";

export const BLIND_AUCTION_ABI: InterfaceAbi = (deployment.abi ?? []) as InterfaceAbi;

export function normalizeAuctionType(value: bigint | number | string): AuctionTypeSlug {
  const numeric = Number(value);
  if (numeric === AUCTION_TYPES.english) {
    return "english";
  }
  if (numeric === AUCTION_TYPES.dutch) {
    return "dutch";
  }

  return "sealed";
}

export function normalizeAuctionStatus(value: bigint | number | string): ContractAuctionStatus {
  const numeric = Number(value);
  if (numeric === 2) {
    return "finalized";
  }
  if (numeric === 1) {
    return "ended";
  }

  return "active";
}

/**
 * Resolve the contract address at call time.
 * Priority: localStorage (set by deploy page), env, deployments.json.
 */
export function getDeployedAddress(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("blindAuctionAddress");
    if (stored && isAddress(stored)) {
      return stored;
    }
  }

  return isAddress(STATIC_ADDRESS) ? STATIC_ADDRESS : "";
}

export function setDeployedAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid contract address.");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("blindAuctionAddress", address);
  }
}

export function getContract(runner: ContractRunner) {
  const address = getDeployedAddress();
  if (!address || !address.startsWith("0x")) {
    throw new Error("No contract deployed yet. Go to /deploy to deploy the BlindAuction contract.");
  }
  if (!deployment.abi?.length) {
    throw new Error("BlindAuction ABI is missing. Rebuild the contracts and frontend deployment metadata.");
  }

  return new Contract(address, BLIND_AUCTION_ABI, runner);
}
