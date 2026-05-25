"use client";

import { BrowserProvider } from "ethers";
import { FormEvent, useState } from "react";
import { AUCTION_TYPE_LABELS } from "@/lib/contract";
import { encryptBid } from "@/lib/fhe";
import { getContract } from "@/lib/contract";
import { isSupabaseConfigured, supabase, type AuctionTypeSlug } from "@/lib/supabase";
import { useWallet } from "./WalletConnect";

type BidFormProps = {
  contractAuctionId: number;
  supabaseAuctionId: string;
  auctionType: AuctionTypeSlug;
  currentBid?: string;
  currentDutchPrice?: string;
  startPrice?: string;
  tokenUnit?: string;
  onBidPlaced?: () => void;
};

function readableError(error: any) {
  const message = error?.shortMessage || error?.reason || error?.message;
  if (!message) {
    return "Failed to place bid.";
  }
  if (message.includes("BidTooLow")) {
    return "Bid is below the required price.";
  }
  if (message.includes("AuctionHasEnded") || message.includes("AuctionNotActive")) {
    return "This auction is no longer accepting bids.";
  }

  return message;
}

function amountLabel(auctionType: AuctionTypeSlug, tokenUnit: string = "USDC") {
  if (auctionType === "dutch") {
    return `Maximum amount (${tokenUnit})`;
  }
  if (auctionType === "english") {
    return `Bid amount (${tokenUnit})`;
  }

  return `Sealed bid amount (${tokenUnit})`;
}

export default function BidForm({
  contractAuctionId,
  supabaseAuctionId,
  auctionType,
  currentBid,
  currentDutchPrice,
  startPrice,
  tokenUnit = "USDC",
  onBidPlaced,
}: BidFormProps) {
  const { address, signer, connectWallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getActiveSigner() {
    if (signer && address) {
      return { activeSigner: signer, activeAddress: address };
    }

    await connectWallet();

    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    const provider = new BrowserProvider(window.ethereum as any);
    const activeSigner = await provider.getSigner();
    const activeAddress = await activeSigner.getAddress();
    return { activeSigner, activeAddress };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { activeSigner, activeAddress } = await getActiveSigner();
      const submittedAmount = auctionType === "dutch" && !amount ? currentDutchPrice ?? "0" : amount;
      const numericAmount = Number(submittedAmount);
      const encryptedOnChainAmount = encryptBid(numericAmount);
      const contract = getContract(activeSigner);
      const tx = await contract.placeBid(contractAuctionId, encryptedOnChainAmount);
      const receipt = await tx.wait();

      if (isSupabaseConfigured && supabase) {
        const { error: insertError } = await supabase.from("bids").insert({
          auction_id: supabaseAuctionId,
          bidder_address: activeAddress,
          tx_hash: receipt?.hash ?? tx.hash,
        });

        if (insertError) {
          throw insertError;
        }
      }

      setAmount("");
      setMessage(
        auctionType === "dutch"
          ? "Dutch auction accepted and finalized."
          : auctionType === "english"
            ? "Bid submitted."
            : "Sealed bid submitted.",
      );
      onBidPlaced?.();
    } catch (submitError: any) {
      setError(readableError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const referencePrice =
    auctionType === "dutch"
      ? currentDutchPrice
      : auctionType === "english"
        ? currentBid && currentBid !== "0"
          ? currentBid
          : startPrice
        : startPrice;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-5"
      style={{
        background: "var(--accent-subtle)",
        border: "1px solid var(--card-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {AUCTION_TYPE_LABELS[auctionType]} bid
        </h3>
        {referencePrice && referencePrice !== "0" ? (
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-bold"
            style={{
              background: "var(--badge-bg)",
              color: "var(--text-brand)",
            }}
          >
            {auctionType === "dutch" ? "Price" : "Reference"}: {Number(referencePrice).toLocaleString()} {tokenUnit}
          </span>
        ) : null}
      </div>

      <label className="mt-5 block text-sm font-semibold" style={{ color: "var(--text-secondary)" }} htmlFor="bid-amount">
        {amountLabel(auctionType, tokenUnit)}
      </label>
      <input
        id="bid-amount"
        type="number"
        min="1"
        step="1"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required={auctionType !== "dutch"}
        className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: "var(--input-text)",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
        placeholder={auctionType === "dutch" ? currentDutchPrice ?? "100" : "100"}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 w-full rounded-xl px-5 py-3 font-bold transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "var(--accent)",
          color: "var(--accent-text)",
          boxShadow: "0 4px 20px rgba(6, 148, 255, 0.25)",
        }}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Submitting...
          </span>
        ) : auctionType === "dutch" ? (
          "Accept Current Price"
        ) : (
          "Submit Bid"
        )}
      </button>
      {message ? (
        <p
          className="mt-3 rounded-xl p-3 text-sm"
          style={{
            background: "var(--success-bg)",
            border: "1px solid var(--success-border)",
            color: "var(--success-text)",
          }}
        >
          ✅ {message}
        </p>
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
    </form>
  );
}
