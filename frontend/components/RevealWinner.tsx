"use client";

import { BrowserProvider } from "ethers";
import { useState } from "react";
import { getContract } from "@/lib/contract";
import {
  decryptedValueToAddress,
  decryptAuctionResult,
  initCofheClient,
  toBytes32Handle,
} from "@/lib/fhe";
import { useWallet } from "./WalletConnect";

type RevealWinnerProps = {
  contractAuctionId: number;
  onRevealed?: () => void;
};

function readableError(error: any) {
  const message = error?.shortMessage || error?.reason || error?.message;
  if (!message) {
    return "Failed to reveal winner.";
  }
  if (message.includes("AuctionResultNotReady")) {
    return "Finalize the sealed auction first to publish encrypted result handles.";
  }

  return message;
}

export default function RevealWinner({ contractAuctionId, onRevealed }: RevealWinnerProps) {
  const { provider, signer, connectWallet } = useWallet();
  const [isRevealing, setIsRevealing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winningBid, setWinningBid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getActiveWallet() {
    if (provider && signer) {
      return { activeProvider: provider, activeSigner: signer };
    }

    await connectWallet();

    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    const activeProvider = new BrowserProvider(window.ethereum as any);
    const activeSigner = await activeProvider.getSigner();
    return { activeProvider, activeSigner };
  }

  async function handleReveal() {
    setIsRevealing(true);
    setError(null);

    try {
      const { activeProvider, activeSigner } = await getActiveWallet();
      const contract = getContract(activeSigner);
      const client = await initCofheClient(activeProvider);
      const bidHandle = await contract.getHighestBidHandle(contractAuctionId);
      const bidderHandle = await contract.getHighestBidderHandle(contractAuctionId);
      const { bidResult, bidderResult } = await decryptAuctionResult(client, bidHandle, bidderHandle);
      const winnerAddress = decryptedValueToAddress(bidderResult.decryptedValue);
      const bidDisplay = bidResult.decryptedValue.toString();

      const tx = await contract.revealWinner(
        contractAuctionId,
        toBytes32Handle(bidResult.ctHash),
        bidResult.decryptedValue,
        bidResult.signature,
        toBytes32Handle(bidderResult.ctHash),
        winnerAddress,
        bidderResult.signature,
      );
      await tx.wait();

      setWinner(winnerAddress);
      setWinningBid(bidDisplay);
      onRevealed?.();
    } catch (revealError: any) {
      setError(readableError(revealError));
    } finally {
      setIsRevealing(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(99, 102, 241, 0.06)",
        border: "1px solid rgba(99, 102, 241, 0.15)",
      }}
    >
      <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        🏆 Reveal sealed result
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Decrypt the FHE-encrypted winner and bid amount on-chain.
      </p>
      <button
        type="button"
        onClick={handleReveal}
        disabled={isRevealing}
        className="mt-4 w-full rounded-xl px-5 py-3 font-bold transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "#6366f1",
          color: "#ffffff",
          boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
        }}
      >
        {isRevealing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Decrypting and settling...
          </span>
        ) : (
          "Reveal Winner"
        )}
      </button>
      {winner && winningBid ? (
        <div
          className="mt-4 rounded-xl p-4 text-sm"
          style={{
            background: "var(--success-bg)",
            border: "1px solid var(--success-border)",
          }}
        >
          <p className="break-all" style={{ color: "var(--success-text)" }}>
            <strong>Winner:</strong> {winner}
          </p>
          <p className="mt-1" style={{ color: "var(--success-text)" }}>
            <strong>Winning amount:</strong> {Number(winningBid).toLocaleString()}
          </p>
        </div>
      ) : null}
      {error ? (
        <p
          className="mt-3 rounded-xl p-3 text-sm"
          style={{
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            color: "var(--error-text)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
