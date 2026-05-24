"use client";

import { BrowserProvider } from "ethers";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AUCTION_TYPE_LABELS, AUCTION_TYPES, getContract } from "@/lib/contract";
import { isSupabaseConfigured, supabase, type AuctionTypeSlug } from "@/lib/supabase";
import { useWallet } from "./WalletConnect";

type CreatedEvent = {
  auctionId: bigint;
  endTime: bigint;
};

const TYPE_OPTIONS: AuctionTypeSlug[] = ["sealed", "english", "dutch"];

const TYPE_ICONS: Record<AuctionTypeSlug, string> = {
  sealed: "🔒",
  english: "📈",
  dutch: "📉",
};

const TYPE_DESCRIPTIONS: Record<AuctionTypeSlug, string> = {
  sealed: "Bids are encrypted. Winner revealed after auction ends.",
  english: "Open ascending price. Highest bidder wins.",
  dutch: "Descending price. First buyer wins.",
};

function parsePositiveInteger(value: string, fieldName: string, allowZero = false) {
  const trimmed = value.trim();
  if (!trimmed) {
    return BigInt(0);
  }

  const parsed = BigInt(trimmed);
  if ((!allowZero && parsed <= BigInt(0)) || (allowZero && parsed < BigInt(0))) {
    throw new Error(`${fieldName} must be ${allowZero ? "zero or greater" : "greater than zero"}.`);
  }
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${fieldName} is too large for metadata display.`);
  }

  return parsed;
}

function readableError(error: any) {
  const message = error?.shortMessage || error?.reason || error?.message;
  if (!message) {
    return "Failed to create auction.";
  }
  if (message.includes("InvalidPriceConfig")) {
    return "Dutch auctions need a start price greater than or equal to the reserve price.";
  }

  return message;
}

export default function CreateAuctionForm() {
  const router = useRouter();
  const { signer, address, connectWallet } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [auctionType, setAuctionType] = useState<AuctionTypeSlug>("sealed");
  const [durationHours, setDurationHours] = useState("24");
  const [startPrice, setStartPrice] = useState("1");
  const [reservePrice, setReservePrice] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  function parseAuctionCreated(receipt: any, contract: any): CreatedEvent {
    for (const log of receipt.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "AuctionCreated") {
          return {
            auctionId: parsed.args.auctionId as bigint,
            endTime: parsed.args.endTime as bigint,
          };
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }

    throw new Error("AuctionCreated event was not found in the transaction receipt.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }
      if (!supabase) {
        throw new Error("Supabase client is unavailable.");
      }

      const hours = Number(durationHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("Duration must be greater than zero.");
      }

      const parsedStart = parsePositiveInteger(startPrice, "Start price", auctionType !== "dutch");
      const parsedReserve =
        auctionType === "dutch" ? parsePositiveInteger(reservePrice, "Reserve price", true) : BigInt(0);
      if (auctionType === "dutch" && parsedReserve > parsedStart) {
        throw new Error("Reserve price cannot exceed the Dutch start price.");
      }

      const { activeSigner, activeAddress } = await getActiveSigner();
      const durationSeconds = Math.floor(hours * 3600);
      const contract = getContract(activeSigner);
      const tx = await contract.createAuction(
        durationSeconds,
        AUCTION_TYPES[auctionType],
        parsedStart,
        parsedReserve,
      );
      const receipt = await tx.wait();
      const created = parseAuctionCreated(receipt, contract);

      const { data, error: insertError } = await supabase
        .from("auctions")
        .insert({
          contract_auction_id: Number(created.auctionId),
          seller_address: activeAddress,
          auction_type: auctionType,
          title,
          description: description || null,
          image_url: imageUrl || null,
          start_price: Number(parsedStart),
          reserve_price: Number(parsedReserve),
          end_time: new Date(Number(created.endTime) * 1000).toISOString(),
        })
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push(`/auction/${data.id}`);
    } catch (submitError: any) {
      setError(readableError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--input-text)",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl p-6 sm:p-8"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div>
        <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:ring-2"
          style={{
            ...inputStyle,
            // @ts-ignore
            "--tw-ring-color": "var(--input-focus-border)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
          placeholder="Rare encrypted collectible"
        />
      </div>

      <div>
        <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="auction-type">
          Auction type
        </label>
        <div id="auction-type" className="mt-3 grid gap-3 sm:grid-cols-3">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAuctionType(option)}
              className="group flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-bold transition-all duration-200"
              style={
                auctionType === option
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent-subtle)",
                      color: "var(--text-brand)",
                      boxShadow: "0 2px 12px rgba(6, 148, 255, 0.15)",
                    }
                  : {
                      borderColor: "var(--border-default)",
                      background: "var(--card-bg)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              <span className="text-2xl">{TYPE_ICONS[option]}</span>
              <span>{AUCTION_TYPE_LABELS[option]}</span>
              <span className="text-[11px] font-normal opacity-70">{TYPE_DESCRIPTIONS[option]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
          placeholder="Asset details, settlement terms, and bid unit."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="imageUrl">
            Image URL
          </label>
          <input
            id="imageUrl"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="duration">
            Duration (hours)
          </label>
          <input
            id="duration"
            type="number"
            min="0.01"
            step="0.01"
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            required
            className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="startPrice">
            {auctionType === "dutch" ? "Start price" : "Minimum bid"}
          </label>
          <input
            id="startPrice"
            type="number"
            min={auctionType === "dutch" ? "1" : "0"}
            step="1"
            value={startPrice}
            onChange={(event) => setStartPrice(event.target.value)}
            required
            className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
          />
        </div>

        {auctionType === "dutch" ? (
          <div>
            <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }} htmlFor="reservePrice">
              Reserve price
            </label>
            <input
              id="reservePrice"
              type="number"
              min="0"
              step="1"
              value={reservePrice}
              onChange={(event) => setReservePrice(event.target.value)}
              required
              className="mt-2 w-full rounded-xl px-4 py-3 outline-none transition-all duration-200"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--input-focus-border)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
            />
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl px-6 py-4 font-black transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "var(--accent)",
          color: "var(--accent-text)",
          boxShadow: "0 4px 20px rgba(6, 148, 255, 0.3)",
        }}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Creating auction...
          </span>
        ) : (
          "Create Auction"
        )}
      </button>

      {error ? (
        <p
          className="rounded-xl p-4 text-sm"
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
