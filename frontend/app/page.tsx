"use client";


import { useEffect, useMemo, useState } from "react";
import AuctionCard from "@/components/AuctionCard";
import CreateAuctionForm from "@/components/CreateAuctionForm";
import WalletConnect, { useWallet } from "@/components/WalletConnect";
import ThemeToggle from "@/components/ThemeToggle";
import { getContract, getDeployedAddress } from "@/lib/contract";
import { getReadProvider, loadOnChainAuction, type OnChainAuction } from "@/lib/auction-state";
import { isSupabaseConfigured, supabase, type AuctionRow, isUsingLocalStorageFallback } from "@/lib/supabase";

type TabKey = "all" | "mine" | "create";

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  all: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  mine: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  create: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  ),
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Auctions" },
  { key: "mine", label: "My Auctions" },
  { key: "create", label: "Create Auction" },
];

export default function HomePage() {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [onChainAuctions, setOnChainAuctions] = useState<Record<string, OnChainAuction>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chainWarning, setChainWarning] = useState<string | null>(null);

  const deployedAddress = getDeployedAddress();

  useEffect(() => {
    async function loadAuctions() {
      setIsLoading(true);
      setError(null);
      setChainWarning(null);

      try {
        if (!isSupabaseConfigured || !supabase) {
          setAuctions([]);
          setOnChainAuctions({});
          return;
        }

        const { data, error: selectError } = await supabase
          .from("auctions")
          .select("*")
          .order("created_at", { ascending: false });

        if (selectError) {
          throw selectError;
        }

        const rows = data ?? [];
        setAuctions(rows);

        try {
          const readProvider = getReadProvider();
          const contract = getContract(readProvider);
          const loaded = await Promise.allSettled(
            rows.map(async (auction: AuctionRow) => ({
              id: auction.id,
              value: await loadOnChainAuction(contract, auction.contract_auction_id),
            })),
          );

          const next: Record<string, OnChainAuction> = {};
          for (const result of loaded) {
            if (result.status === "fulfilled") {
              next[result.value.id] = result.value.value;
            }
          }
          setOnChainAuctions(next);
        } catch (chainError: any) {
          setOnChainAuctions({});
          setChainWarning(chainError?.message ?? "On-chain auction state could not be loaded.");
        }
      } catch (loadError: any) {
        setError(loadError?.message ?? "Failed to load auctions.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuctions();
  }, [reloadKey]);

  // Poll for updates instead of using contract.on() which requires
  // eth_newFilter — unsupported by the public Arbitrum Sepolia RPC.
  useEffect(() => {
    if (!deployedAddress) return undefined;
    const timer = window.setInterval(() => {
      setReloadKey((value) => value + 1);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [deployedAddress]);

  const visibleAuctions = useMemo(() => {
    if (activeTab !== "mine") {
      return auctions;
    }
    if (!address) {
      return [];
    }

    return auctions.filter((auction) => auction.seller_address.toLowerCase() === address.toLowerCase());
  }, [activeTab, address, auctions]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-0 sm:px-8 lg:px-10">
      {/* Top Navigation Bar */}
      <nav
        className="sticky top-0 z-50 -mx-5 flex items-center justify-between px-5 py-3 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
        style={{
          background: "var(--nav-bg, var(--card-bg))",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2 font-black text-lg" style={{ color: "var(--text-primary)" }}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              🔒
            </span>
            FHE Auctions
          </a>
          <div className="hidden items-center gap-1 sm:flex">
            <a
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200"
              style={{ color: "var(--text-brand)", background: "var(--accent-subtle)" }}
            >
              Auctions
            </a>
            <a
              href="#about"
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              About
            </a>
            <a
              href="https://docs.fhenix.zone"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Docs ↗
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletConnect />
        </div>
      </nav>

      {/* Centered Hero */}
      <header className="animate-fade-in pb-10 pt-12 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center gap-2">
            <div
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold uppercase tracking-wider"
              style={{
                background: "var(--accent-subtle)",
                color: "var(--text-brand)",
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse-slow" style={{ background: "var(--accent)" }} />
              Fhenix CoFHE
            </div>
          </div>
          <h1
            className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "var(--text-primary)" }}
          >
            Confidential<br />
            <span className="gradient-text">Auction Desk</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Privacy-preserving sealed-bid, English &amp; Dutch auctions powered by fully homomorphic encryption.
          </p>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />

      {/* Tabs */}
      <section className="mt-6 flex justify-center animate-slide-up">
        <div
          className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-2xl p-1.5"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-subtle)",
            backdropFilter: "blur(12px)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200"
              style={
                activeTab === tab.key
                  ? {
                      background: "var(--tab-active-bg)",
                      color: "var(--tab-active-text)",
                      boxShadow: "0 2px 12px rgba(6, 148, 255, 0.25)",
                    }
                  : {
                      color: "var(--tab-inactive-text)",
                      background: "transparent",
                    }
              }
            >
              {TAB_ICONS[tab.key]}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Info banners */}
      {isUsingLocalStorageFallback ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-in"
          style={{
            background: "var(--info-bg)",
            border: "1px solid var(--info-border)",
            color: "var(--info-text)",
          }}
        >
          <span className="text-lg">💡</span>
          <div>
            <strong className="font-semibold">Demo Sandboxed Mode</strong>
            <span className="opacity-80"> — Storing auctions in browser local storage. Connect MetaMask and deploy the contract to experience Fhenix confidential auctions locally.</span>
          </div>
        </div>
      ) : null}

      {chainWarning ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-in"
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            color: "var(--warning-text)",
          }}
        >
          <span className="text-lg">⚠️</span>
          <span>{chainWarning}</span>
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
          <span className="text-lg">❌</span>
          <span>{error}</span>
        </div>
      ) : null}

      {/* Content */}
      {activeTab === "create" ? (
        <section className="mx-auto mt-8 w-full max-w-4xl animate-slide-up">
          <CreateAuctionForm />
        </section>
      ) : isLoading ? (
        <div className="mt-12 flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--border-default)", borderTopColor: "transparent" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Loading auctions...</p>
        </div>
      ) : activeTab === "mine" && !address ? (
        <div
          className="mt-12 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-16 text-center animate-slide-up"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="text-5xl">🔗</div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Connect a wallet</h2>
          <p style={{ color: "var(--text-secondary)" }}>Your auctions are filtered by seller address.</p>
        </div>
      ) : visibleAuctions.length === 0 ? (
        <div
          className="mt-12 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-16 text-center animate-slide-up"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="text-5xl animate-float">🎯</div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>No auctions found</h2>
          <p style={{ color: "var(--text-secondary)" }}>Create an auction to add it to the marketplace.</p>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className="mt-4 rounded-xl px-8 py-3.5 font-bold transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              boxShadow: "0 4px 20px rgba(6, 148, 255, 0.3)",
            }}
          >
            Create Auction
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3 animate-slide-up">
          {visibleAuctions.map((auction, i) => (
            <div key={auction.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-slide-up">
              <AuctionCard auction={auction} onChain={onChainAuctions[auction.id]} />
            </div>
          ))}
        </div>
      )}

      {/* About Section */}
      <section id="about" className="mt-20 pb-16">
        <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
        <div className="mx-auto max-w-3xl pt-16 text-center">
          <h2
            className="text-3xl font-black tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            What is <span className="gradient-text">FHE Auctions</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            FHE Auctions uses Fully Homomorphic Encryption on Fhenix to run truly confidential auctions. Bids are encrypted on-chain — even the contract can&apos;t see them until the auction ends.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="text-3xl">🛡️</div>
              <h3 className="mt-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Privacy First</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Sealed bids are encrypted with FHE. No one — not even validators — can see bid amounts before reveal.
              </p>
            </div>
            <div
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="text-3xl">⚡</div>
              <h3 className="mt-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Trustless</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                All auction logic executes on-chain via smart contracts. No intermediary, no trusted auctioneer needed.
              </p>
            </div>
            <div
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="text-3xl">🎯</div>
              <h3 className="mt-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Flexible</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Supports sealed-bid, English ascending, and Dutch descending auction types — each with unique mechanics.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
