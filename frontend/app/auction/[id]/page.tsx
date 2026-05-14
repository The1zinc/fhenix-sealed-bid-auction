"use client";

import { BrowserProvider, JsonRpcProvider } from "ethers";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuctionStatus from "@/components/AuctionStatus";
import BidForm from "@/components/BidForm";
import RevealWinner from "@/components/RevealWinner";
import WalletConnect, { useWallet } from "@/components/WalletConnect";
import { getContract } from "@/lib/contract";
import { supabase, type AuctionRow, type BidRow } from "@/lib/supabase";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

type OnChainAuction = {
  seller: string;
  endTime: number;
  closed: boolean;
  settled: boolean;
  winningBid: string;
  winningBidder: string;
};

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const { address, signer, connectWallet } = useWallet();
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [onChain, setOnChain] = useState<OnChainAuction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuction() {
      if (!params.id) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select("*")
          .eq("id", params.id)
          .single();

        if (auctionError) {
          throw auctionError;
        }

        setAuction(auctionData);

        const { data: bidData, error: bidError } = await supabase
          .from("bids")
          .select("*")
          .eq("auction_id", params.id)
          .order("placed_at", { ascending: false });

        if (bidError) {
          throw bidError;
        }

        setBids(bidData ?? []);

        const readProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL);
        const contract = getContract(readProvider);
        const info = await contract.getAuctionInfo(auctionData.contract_auction_id);

        setOnChain({
          seller: info.seller,
          endTime: Number(info.endTime),
          closed: info.closed,
          settled: info.settled,
          winningBid: info.winningBid.toString(),
          winningBidder: info.winningBidder,
        });
      } catch (loadError: any) {
        setError(loadError?.message ?? "Failed to load auction.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuction();
  }, [params.id, reloadKey]);

  async function getActiveSigner() {
    if (signer) {
      return signer;
    }

    await connectWallet();

    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    const provider = new BrowserProvider(window.ethereum as any);
    return provider.getSigner();
  }

  async function closeAuction() {
    if (!auction) {
      return;
    }

    setIsClosing(true);
    setError(null);

    try {
      const activeSigner = await getActiveSigner();
      const contract = getContract(activeSigner);
      const tx = await contract.closeAuction(auction.contract_auction_id);
      await tx.wait();

      const { error: updateError } = await supabase
        .from("auctions")
        .update({ is_closed: true, updated_at: new Date().toISOString() })
        .eq("id", auction.id);

      if (updateError) {
        throw updateError;
      }

      setReloadKey((value) => value + 1);
    } catch (closeError: any) {
      setError(closeError?.message ?? "Failed to close auction.");
    } finally {
      setIsClosing(false);
    }
  }

  if (isLoading) {
    return <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 text-center text-slate-300">Loading auction...</main>;
  }

  if (!auction) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 text-center">
        <p className="text-slate-300">Auction not found.</p>
        <Link href="/" className="mt-4 inline-block text-cyan-200 underline">
          Back to auctions
        </Link>
      </main>
    );
  }

  const endTimeSeconds = onChain?.endTime ?? Math.floor(new Date(auction.end_time).getTime() / 1000);
  const closed = onChain?.closed ?? Boolean(auction.is_closed);
  const settled = onChain?.settled ?? Boolean(auction.is_settled);
  const isOpen = !closed && !settled && Date.now() / 1000 < endTimeSeconds;
  const isSeller = Boolean(address && onChain?.seller && address.toLowerCase() === onChain.seller.toLowerCase());
  const winner = auction.winning_bidder || (onChain?.winningBidder !== ZERO_ADDRESS ? onChain?.winningBidder : null);
  const winningBid = auction.winning_bid_display || (onChain?.winningBid !== "0" ? onChain?.winningBid : null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm text-cyan-200 hover:text-cyan-100">
            Back to auctions
          </Link>
          <h1 className="mt-3 text-4xl font-black text-white">{auction.title}</h1>
        </div>
        <WalletConnect />
      </header>

      {error ? <div className="mt-6 rounded-2xl border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
          <div className="aspect-[16/9] bg-slate-950">
            {auction.image_url ? (
              <img src={auction.image_url} alt={auction.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#334155,#020617)] text-sm uppercase tracking-[0.4em] text-slate-400">
                Sealed Auction
              </div>
            )}
          </div>
          <div className="space-y-5 p-6">
            <AuctionStatus endTime={endTimeSeconds} closed={closed} settled={settled} />
            <p className="text-slate-300">{auction.description || "No description provided."}</p>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-950/60 p-4">
                <p className="text-slate-500">Contract auction ID</p>
                <p className="mt-1 font-semibold text-white">#{auction.contract_auction_id}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/60 p-4">
                <p className="text-slate-500">Seller</p>
                <p className="mt-1 break-all font-semibold text-white">{onChain?.seller ?? auction.seller_address}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/60 p-4 sm:col-span-2">
                <p className="text-slate-500">Ends</p>
                <p className="mt-1 font-semibold text-white">{new Date(endTimeSeconds * 1000).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          {isOpen ? (
            <BidForm
              contractAuctionId={auction.contract_auction_id}
              supabaseAuctionId={auction.id}
              onBidPlaced={() => setReloadKey((value) => value + 1)}
            />
          ) : null}

          {isSeller && !closed ? (
            <div className="rounded-3xl border border-amber-200/20 bg-amber-300/[0.08] p-5">
              <h3 className="text-lg font-semibold text-white">Seller controls</h3>
              <p className="mt-2 text-sm text-amber-100/80">Close the auction to make encrypted handles public for proof-backed reveal.</p>
              <button
                type="button"
                onClick={closeAuction}
                disabled={isClosing}
                className="mt-4 w-full rounded-2xl bg-amber-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosing ? "Closing..." : "Close Auction"}
              </button>
            </div>
          ) : null}

          {closed && !settled ? (
            <RevealWinner
              contractAuctionId={auction.contract_auction_id}
              supabaseAuctionId={auction.id}
              onRevealed={() => setReloadKey((value) => value + 1)}
            />
          ) : null}

          {settled ? (
            <div className="rounded-3xl border border-purple-200/20 bg-purple-300/[0.08] p-5">
              <h3 className="text-lg font-semibold text-white">Final result</h3>
              <p className="mt-3 break-all text-sm text-slate-200">Winner: {winner ?? "Pending Supabase sync"}</p>
              <p className="mt-2 text-sm text-slate-200">Winning amount: {winningBid ?? "Pending Supabase sync"}</p>
            </div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <h3 className="text-lg font-semibold text-white">Bid history</h3>
            <p className="mt-1 text-sm text-slate-400">Bid amounts are never stored in Supabase.</p>
            <div className="mt-4 space-y-3">
              {bids.length === 0 ? (
                <p className="text-sm text-slate-400">No bid metadata yet.</p>
              ) : (
                bids.map((bid) => (
                  <div key={bid.id} className="rounded-2xl bg-slate-950/60 p-3 text-sm">
                    <p className="break-all text-slate-200">{bid.bidder_address}</p>
                    {bid.tx_hash ? <p className="mt-1 break-all text-xs text-slate-500">Tx: {bid.tx_hash}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
