import { Contract, type ContractRunner, type InterfaceAbi } from "ethers";
import deployments from "./deployments.json";

const DEFAULT_ABI = [
  {
    type: "function",
    name: "createAuction",
    stateMutability: "nonpayable",
    inputs: [{ name: "durationSeconds", type: "uint256" }],
    outputs: [{ name: "auctionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "placeBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeAuction",
    stateMutability: "nonpayable",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revealWinner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "auctionId", type: "uint256" },
      { name: "bidCtHash", type: "bytes32" },
      { name: "bidPlaintext", type: "uint64" },
      { name: "bidSignature", type: "bytes" },
      { name: "bidderCtHash", type: "bytes32" },
      { name: "bidderPlaintext", type: "address" },
      { name: "bidderSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAuctionInfo",
    stateMutability: "view",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "endTime", type: "uint256" },
      { name: "closed", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "winningBid", type: "uint64" },
      { name: "winningBidder", type: "address" },
    ],
  },
  {
    type: "function",
    name: "getHighestBidHandle",
    stateMutability: "view",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getHighestBidderHandle",
    stateMutability: "view",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "auctionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AuctionCreated",
    anonymous: false,
    inputs: [
      { name: "auctionId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BidPlaced",
    anonymous: false,
    inputs: [
      { name: "auctionId", type: "uint256", indexed: true },
      { name: "bidder", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AuctionClosed",
    anonymous: false,
    inputs: [{ name: "auctionId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "WinnerRevealed",
    anonymous: false,
    inputs: [
      { name: "auctionId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "amount", type: "uint64", indexed: false },
    ],
  },
] as const;

type Deployment = {
  address?: string;
  abi?: unknown[];
};

const deployment = deployments as Deployment;

export const BLIND_AUCTION_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || deployment.address || "";
export const BLIND_AUCTION_ABI: InterfaceAbi = (deployment.abi?.length ? deployment.abi : DEFAULT_ABI) as InterfaceAbi;

export function getContract(runner: ContractRunner) {
  if (!BLIND_AUCTION_ADDRESS || !BLIND_AUCTION_ADDRESS.startsWith("0x")) {
    throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS. Deploy the contract and update frontend/.env.local.");
  }

  return new Contract(BLIND_AUCTION_ADDRESS, BLIND_AUCTION_ABI, runner);
}
