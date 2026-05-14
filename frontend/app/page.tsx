"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuctionCard from "@/components/AuctionCard";
import WalletConnect from "@/components/WalletConnect";
import { isSupabaseConfigured, supabase, type AuctionRow } from "@/lib/supabase";

export default function HomePage() {
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuctions() {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: selectError } = await supabase
          .from("auctions")
          .select("*")
          .order("created_at", { ascending: false });

        if (selectError) {
          throw selectError;
        }

        setAuctions(data ?? []);
      } catch (loadError: any) {
        setError(loadError?.message ?? "Failed to load auctions.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuctions();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-200/80">Fhenix CoFHE</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
            Confidential Auctions
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Create sealed-bid auctions where bids are encrypted on-chain and only the final result is revealed after settlement.
          </p>
        </div>
        <WalletConnect />
      </header>

      <section className="mt-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Auction marketplace</h2>
          <p className="mt-1 text-sm text-slate-300">Metadata lives in Supabase. Bid amounts never leave encrypted contract state.</p>
        </div>
        <Link
          href="/create"
          className="rounded-full bg-cyan-300 px-6 py-3 text-center font-bold text-slate-950 transition hover:bg-cyan-200"
        >
          Create Auction
        </Link>
      </section>

      {!isSupabaseConfigured ? (
        <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          Supabase environment variables are not configured. Add them to frontend/.env.local after running database.sql.
        </div>
      ) : null}

      {error ? <div className="mt-6 rounded-2xl border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">{error}</div> : null}

      {isLoading ? (
        <div className="mt-12 text-center text-slate-300">Loading auctions...</div>
      ) : auctions.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <h2 className="text-2xl font-bold text-white">No auctions yet</h2>
          <p className="mt-2 text-slate-300">Deploy the contract, configure Supabase, and create the first confidential auction.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </main>
  );
}
