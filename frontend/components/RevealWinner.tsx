"use client";

import { useState } from "react";
import { getContract } from "@/lib/contract";
import {
  decryptedValueToAddress,
  decryptAuctionResult,
  initCofheClient,
  toBytes32Handle,
} from "@/lib/fhe";
import { supabase } from "@/lib/supabase";
import { useWallet } from "./WalletConnect";

type RevealWinnerProps = {
  contractAuctionId: number;
  supabaseAuctionId: string;
  onRevealed?: () => void;
};

export default function RevealWinner({ contractAuctionId, supabaseAuctionId, onRevealed }: RevealWinnerProps) {
  const { provider, signer, connectWallet } = useWallet();
  const [isRevealing, setIsRevealing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winningBid, setWinningBid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setIsRevealing(true);
    setError(null);

    try {
      if (!provider || !signer) {
        await connectWallet();
        throw new Error("Wallet connected. Click Reveal Winner again to sign the settlement transaction.");
      }

      const contract = getContract(signer);
      const client = await initCofheClient(provider);
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

      const { error: updateError } = await supabase
        .from("auctions")
        .update({
          is_settled: true,
          winning_bidder: winnerAddress,
          winning_bid_display: bidDisplay,
          updated_at: new Date().toISOString(),
        })
        .eq("id", supabaseAuctionId);

      if (updateError) {
        throw updateError;
      }

      setWinner(winnerAddress);
      setWinningBid(bidDisplay);
      onRevealed?.();
    } catch (revealError: any) {
      setError(revealError?.message ?? "Failed to reveal winner.");
    } finally {
      setIsRevealing(false);
    }
  }

  return (
    <div className="rounded-3xl border border-purple-200/20 bg-purple-300/[0.08] p-5">
      <h3 className="text-lg font-semibold text-white">Reveal encrypted result</h3>
      <p className="mt-2 text-sm leading-6 text-purple-100/80">
        The seller has closed this auction. Decrypt the public CoFHE handles off-chain and submit the signed proof on-chain.
      </p>
      <button
        type="button"
        onClick={handleReveal}
        disabled={isRevealing}
        className="mt-4 w-full rounded-2xl bg-purple-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRevealing ? "Decrypting and settling..." : "Reveal Winner"}
      </button>
      {winner && winningBid ? (
        <div className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-200">
          <p>Winner: {winner}</p>
          <p>Winning amount: {winningBid}</p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
