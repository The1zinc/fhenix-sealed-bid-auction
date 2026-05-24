import { JsonRpcProvider } from "ethers";
import {
  normalizeAuctionStatus,
  normalizeAuctionType,
  type ContractAuctionStatus,
} from "./contract";
import type { AuctionTypeSlug } from "./supabase";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DEFAULT_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

export type OnChainAuction = {
  seller: string;
  auctionType: AuctionTypeSlug;
  status: ContractAuctionStatus;
  startTime: number;
  endTime: number;
  startPrice: string;
  reservePrice: string;
  currentBid: string;
  currentBidder: string;
  winningBid: string;
  winningBidder: string;
  encryptedResultReady: boolean;
  currentDutchPrice?: string;
};

export function getReadProvider() {
  return new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL);
}

export function isZeroAddress(value?: string | null) {
  return !value || value.toLowerCase() === ZERO_ADDRESS;
}

export function parseOnChainAuction(info: any): OnChainAuction {
  return {
    seller: info.seller ?? info[0],
    auctionType: normalizeAuctionType(info.auctionType ?? info[1]),
    status: normalizeAuctionStatus(info.status ?? info[2]),
    startTime: Number(info.startTime ?? info[3]),
    endTime: Number(info.endTime ?? info[4]),
    startPrice: (info.startPrice ?? info[5]).toString(),
    reservePrice: (info.reservePrice ?? info[6]).toString(),
    currentBid: (info.currentBid ?? info[7]).toString(),
    currentBidder: info.currentBidder ?? info[8],
    winningBid: (info.winningBid ?? info[9]).toString(),
    winningBidder: info.winningBidder ?? info[10],
    encryptedResultReady: false,
  };
}

export async function loadOnChainAuction(contract: any, contractAuctionId: number): Promise<OnChainAuction> {
  const info = await contract.getAuctionInfo(contractAuctionId);
  const parsed = parseOnChainAuction(info);

  if (parsed.auctionType === "dutch" && parsed.status === "active") {
    try {
      const price = await contract.currentDutchPrice(contractAuctionId);
      parsed.currentDutchPrice = price.toString();
    } catch {
      parsed.currentDutchPrice = parsed.startPrice;
    }
  }
  if (parsed.auctionType === "sealed" && parsed.status === "ended") {
    try {
      parsed.encryptedResultReady = await contract.isEncryptedResultReady(contractAuctionId);
    } catch {
      parsed.encryptedResultReady = false;
    }
  }

  return parsed;
}
