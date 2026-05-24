"use client";

import { BrowserProvider } from "ethers";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuctionStatus from "@/components/AuctionStatus";
import BidForm from "@/components/BidForm";
import RevealWinner from "@/components/RevealWinner";
import WalletConnect, { useWallet } from "@/components/WalletConnect";
import ThemeToggle from "@/components/ThemeToggle";
import { AUCTION_TYPE_LABELS, getContract, type ContractAuctionStatus } from "@/lib/contract";
import {
  getReadProvider,
  isZeroAddress,
  loadOnChainAuction,
  type OnChainAuction,
} from "@/lib/auction-state";
import { isSupabaseConfigured, supabase, type AuctionRow, type BidRow } from "@/lib/supabase";

function fallbackStatus(auction: AuctionRow): ContractAuctionStatus {
  return Date.now() >= new Date(auction.end_time).getTime() ? "ended" : "active";
}

function formatAmount(value?: string | number | null) {
  if (value === undefined || value === null || value === "" || value === "0") {
    return "None";
  }

  try {
    return BigInt(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function readableError(error: any) {
  const message = error?.shortMessage || error?.reason || error?.message;
  if (!message) {
    return "Transaction failed.";
  }
  if (message.includes("AuctionNotEnded")) {
    return "This auction has not ended yet.";
  }
  if (message.includes("AuctionEndedAlready")) {
    return "Encrypted sealed-bid handles are already public. Reveal the winner next.";
  }
  if (message.includes("AuctionAlreadyFinalized")) {
    return "This auction is already finalized.";
  }

  return message;
}

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const { address, signer, connectWallet } = useWallet();
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [onChain, setOnChain] = useState<OnChainAuction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuction() {
      if (!params.id) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error("Supabase environment variables are not configured.");
        }

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

        const contract = getContract(getReadProvider());
        const chainState = await loadOnChainAuction(contract, auctionData.contract_auction_id);
        setOnChain(chainState);
      } catch (loadError: any) {
        setError(loadError?.message ?? "Failed to load auction.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuction();
  }, [params.id, reloadKey]);

  // Poll for updates instead of using contract.on() which requires
  // eth_newFilter — unsupported by the public Arbitrum Sepolia RPC.
  useEffect(() => {
    if (!auction) return undefined;
    const timer = window.setInterval(() => {
      setReloadKey((value) => value + 1);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [auction]);

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

  async function finalizeAuction() {
    if (!auction) {
      return;
    }

    setIsFinalizing(true);
    setError(null);
    setMessage(null);

    try {
      const activeSigner = await getActiveSigner();
      const contract = getContract(activeSigner);
      const tx = await contract.finalizeAuction(auction.contract_auction_id);
      await tx.wait();

      setMessage(onChain?.auctionType === "sealed" ? "Encrypted result handles are public." : "Auction finalized.");
      setReloadKey((value) => value + 1);
    } catch (finalizeError: any) {
      setError(readableError(finalizeError));
      setReloadKey((value) => value + 1);
    } finally {
      setIsFinalizing(false);
    }
  }

  const display = useMemo(() => {
    if (!auction) {
      return null;
    }

    const auctionType = onChain?.auctionType ?? auction.auction_type ?? "sealed";
    const status = onChain?.status ?? fallbackStatus(auction);
    const endTimeSeconds = onChain?.endTime ?? Math.floor(new Date(auction.end_time).getTime() / 1000);
    const startPrice = onChain?.startPrice ?? String(auction.start_price ?? 0);
    const reservePrice = onChain?.reservePrice ?? String(auction.reserve_price ?? 0);
    const currentBid = onChain?.currentBid ?? "0";
    const currentDutchPrice = onChain?.currentDutchPrice;
    const winningBid = onChain?.winningBid ?? "0";
    const winningBidder = onChain?.winningBidder ?? null;

    return {
      auctionType,
      status,
      endTimeSeconds,
      startPrice,
      reservePrice,
      currentBid,
      currentDutchPrice,
      winningBid,
      winningBidder,
      seller: onChain?.seller ?? auction.seller_address,
      encryptedResultReady: Boolean(onChain?.encryptedResultReady),
    };
  }, [auction, onChain]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5 py-10">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--border-default)", borderTopColor: "transparent" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Loading auction...</p>
        </div>
      </main>
    );
  }

  if (!auction || !display) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-10 text-center">
        <div className="text-5xl">🔍</div>
        <p className="mt-4" style={{ color: "var(--text-secondary)" }}>Auction not found.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium underline"
          style={{ color: "var(--text-brand)" }}
        >
          Back to auctions
        </Link>
      </main>
    );
  }

  const isOpen = display.status === "active" && Date.now() / 1000 < display.endTimeSeconds;
  const isSeller = Boolean(address && display.seller && address.toLowerCase() === display.seller.toLowerCase());
  const canFinalize =
    display.status === "ended" && (display.auctionType !== "sealed" || !display.encryptedResultReady);
  const canReveal = display.auctionType === "sealed" && display.status === "ended" && display.encryptedResultReady;
  const hasWinner = display.status === "finalized" && !isZeroAddress(display.winningBidder);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8">
      {/* Header */}
      <header className="animate-fade-in pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              style={{ color: "var(--text-brand)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to auctions
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
              {auction.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />

      {/* Banners */}
      {message ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-in"
          style={{
            background: "var(--success-bg)",
            border: "1px solid var(--success-border)",
            color: "var(--success-text)",
          }}
        >
          <span>✅</span> {message}
        </div>
      ) : null}
      {error ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-in"
          style={{
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            color: "var(--error-text)",
          }}
        >
          <span>❌</span> {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] animate-slide-up">
        {/* Main content */}
        <section
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="aspect-[16/9]" style={{ background: "var(--surface-100)" }}>
            {auction.image_url ? (
              <img src={auction.image_url} alt={auction.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, var(--surface-100), var(--surface-200))",
                  color: "var(--text-tertiary)",
                }}
              >
                <span className="text-5xl opacity-60">
                  {display.auctionType === "sealed" ? "🔒" : display.auctionType === "english" ? "📈" : "📉"}
                </span>
                <span className="text-sm font-bold uppercase tracking-wider">
                  {AUCTION_TYPE_LABELS[display.auctionType]}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AuctionStatus endTime={display.endTimeSeconds} status={display.status} />
              <span
                className="rounded-lg px-3 py-1 text-sm font-bold"
                style={{
                  background: "var(--badge-bg)",
                  color: "var(--badge-text)",
                }}
              >
                {AUCTION_TYPE_LABELS[display.auctionType]}
              </span>
            </div>
            <p className="leading-7" style={{ color: "var(--text-secondary)" }}>
              {auction.description || "No description provided."}
            </p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Contract auction ID</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>#{auction.contract_auction_id}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Seller</p>
                <p className="mt-1 break-all font-bold" style={{ color: "var(--text-primary)" }}>
                  {display.seller}
                  {isSeller ? " (you)" : ""}
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Ends</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>
                  {new Date(display.endTimeSeconds * 1000).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Price</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>
                  {display.auctionType === "dutch"
                    ? formatAmount(display.currentDutchPrice ?? display.currentBid ?? display.startPrice)
                    : display.auctionType === "english"
                      ? formatAmount(display.currentBid)
                      : formatAmount(display.startPrice)}
                </p>
              </div>
              {display.auctionType === "dutch" ? (
                <div className="rounded-xl p-4 sm:col-span-2" style={{ background: "var(--badge-bg)" }}>
                  <p style={{ color: "var(--text-tertiary)" }}>Reserve price</p>
                  <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>
                    {formatAmount(display.reservePrice)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-5">
          {isOpen ? (
            <BidForm
              contractAuctionId={auction.contract_auction_id}
              supabaseAuctionId={auction.id}
              auctionType={display.auctionType}
              currentBid={display.currentBid}
              currentDutchPrice={display.currentDutchPrice}
              startPrice={display.startPrice}
              onBidPlaced={() => setReloadKey((value) => value + 1)}
            />
          ) : null}

          {canFinalize ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
              }}
            >
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                ⚡ {display.auctionType === "sealed" ? "Publish encrypted result" : "Finalize auction"}
              </h3>
              <button
                type="button"
                onClick={finalizeAuction}
                disabled={isFinalizing}
                className="mt-4 w-full rounded-xl px-5 py-3 font-bold transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "#f59e0b",
                  color: "#0f172a",
                  boxShadow: "0 4px 20px rgba(245, 158, 11, 0.3)",
                }}
              >
                {isFinalizing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Finalizing...
                  </span>
                ) : (
                  "Finalize Auction"
                )}
              </button>
            </div>
          ) : null}

          {canReveal ? (
            <RevealWinner
              contractAuctionId={auction.contract_auction_id}
              onRevealed={() => setReloadKey((value) => value + 1)}
            />
          ) : null}

          {display.status === "finalized" ? (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(99, 102, 241, 0.06)",
                border: "1px solid rgba(99, 102, 241, 0.15)",
              }}
            >
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>🏆 Final result</h3>
              {hasWinner ? (
                <>
                  <p className="mt-3 break-all text-sm" style={{ color: "var(--text-secondary)" }}>
                    <strong>Winner:</strong> {display.winningBidder}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <strong>Winning amount:</strong> {formatAmount(display.winningBid)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm" style={{ color: "var(--text-tertiary)" }}>No winning bid.</p>
              )}
            </div>
          ) : null}

          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              backdropFilter: "blur(16px)",
            }}
          >
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>📜 Bid history</h3>
            <div className="mt-4 space-y-3">
              {bids.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No bid metadata yet.</p>
              ) : (
                bids.map((bid) => (
                  <div
                    key={bid.id}
                    className="rounded-xl p-3 text-sm"
                    style={{ background: "var(--badge-bg)" }}
                  >
                    <p className="break-all" style={{ color: "var(--text-secondary)" }}>{bid.bidder_address}</p>
                    {bid.tx_hash ? (
                      <p className="mt-1 break-all text-xs" style={{ color: "var(--text-tertiary)" }}>
                        Tx: {bid.tx_hash}
                      </p>
                    ) : null}
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
