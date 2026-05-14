"use client";

import { BrowserProvider } from "ethers";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import WalletConnect, { useWallet } from "@/components/WalletConnect";
import { getContract } from "@/lib/contract";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type CreatedEvent = {
  auctionId: bigint;
  endTime: bigint;
};

export default function CreateAuctionPage() {
  const router = useRouter();
  const { signer, address, connectWallet } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [durationHours, setDurationHours] = useState("24");
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

      const hours = Number(durationHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("Duration must be greater than zero.");
      }

      const { activeSigner, activeAddress } = await getActiveSigner();
      const durationSeconds = Math.floor(hours * 3600);
      const contract = getContract(activeSigner);
      const tx = await contract.createAuction(durationSeconds);
      const receipt = await tx.wait();
      const created = parseAuctionCreated(receipt, contract);

      const { data, error: insertError } = await supabase
        .from("auctions")
        .insert({
          contract_auction_id: Number(created.auctionId),
          seller_address: activeAddress,
          title,
          description: description || null,
          image_url: imageUrl || null,
          end_time: new Date(Number(created.endTime) * 1000).toISOString(),
        })
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push(`/auction/${data.id}`);
    } catch (submitError: any) {
      setError(submitError?.message ?? "Failed to create auction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6 sm:px-8">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-200/80">Create</p>
          <h1 className="mt-3 text-4xl font-black text-white">New sealed auction</h1>
        </div>
        <WalletConnect />
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <div>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300"
            placeholder="Rare encrypted collectible"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300"
            placeholder="Describe the asset, settlement terms, and bid unit."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="imageUrl">
            Image URL
          </label>
          <input
            id="imageUrl"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="duration">
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
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-cyan-300 px-6 py-4 font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating auction..." : "Create Auction"}
        </button>

        {error ? <p className="rounded-2xl border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">{error}</p> : null}
      </form>
    </main>
  );
}
