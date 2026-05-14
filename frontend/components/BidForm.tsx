"use client";

import { FormEvent, useState } from "react";
import { getContract } from "@/lib/contract";
import { encryptBid } from "@/lib/fhe";
import { supabase } from "@/lib/supabase";
import { useWallet } from "./WalletConnect";

type BidFormProps = {
  contractAuctionId: number;
  supabaseAuctionId: string;
  onBidPlaced?: () => void;
};

export default function BidForm({ contractAuctionId, supabaseAuctionId, onBidPlaced }: BidFormProps) {
  const { address, signer, connectWallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!signer || !address) {
        await connectWallet();
        throw new Error("Wallet connected. Submit the bid again to sign the transaction.");
      }

      const numericAmount = Number(amount);
      const encryptedOnChainAmount = encryptBid(numericAmount);
      const contract = getContract(signer);
      const tx = await contract.placeBid(contractAuctionId, encryptedOnChainAmount);
      const receipt = await tx.wait();

      const { error: insertError } = await supabase.from("bids").insert({
        auction_id: supabaseAuctionId,
        bidder_address: address,
        tx_hash: receipt?.hash ?? tx.hash,
      });

      if (insertError) {
        throw insertError;
      }

      setAmount("");
      setMessage("Bid submitted and encrypted on-chain.");
      onBidPlaced?.();
    } catch (submitError: any) {
      setError(submitError?.message ?? "Failed to place bid.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.06] p-5">
      <h3 className="text-lg font-semibold text-white">Place a confidential bid</h3>
      <p className="mt-2 text-sm leading-6 text-cyan-100/80">
        Your bid amount is encrypted on-chain. No one can see your bid or the current highest bid.
      </p>
      <label className="mt-5 block text-sm font-medium text-slate-200" htmlFor="bid-amount">
        Bid amount (whole auction units)
      </label>
      <input
        id="bid-amount"
        type="number"
        min="1"
        step="1"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
        placeholder="100"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 w-full rounded-2xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Encrypting on-chain..." : "Submit Bid"}
      </button>
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
