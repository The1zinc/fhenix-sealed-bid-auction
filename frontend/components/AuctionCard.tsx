"use client";

import Link from "next/link";
import AuctionStatus from "./AuctionStatus";
import { AUCTION_TYPE_LABELS, type ContractAuctionStatus } from "@/lib/contract";
import type { OnChainAuction } from "@/lib/auction-state";
import type { AuctionRow } from "@/lib/supabase";

type AuctionCardProps = {
  auction: AuctionRow;
  onChain?: OnChainAuction | null;
};

function fallbackStatus(auction: AuctionRow): ContractAuctionStatus {
  return Date.now() >= new Date(auction.end_time).getTime() ? "ended" : "active";
}

function formatAmount(value?: string | number | null, tokenUnit?: string) {
  if (value === undefined || value === null || value === "" || value === "0") {
    return "Not set";
  }

  return `${Number(value).toLocaleString()} ${tokenUnit || "USDC"}`;
}

const TYPE_COLORS: Record<string, string> = {
  sealed: "rgba(139, 92, 246, 0.15)",
  english: "rgba(16, 185, 129, 0.15)",
  dutch: "rgba(245, 158, 11, 0.15)",
};

const TYPE_TEXT_COLORS: Record<string, string> = {
  sealed: "#a78bfa",
  english: "#34d399",
  dutch: "#fbbf24",
};

export default function AuctionCard({ auction, onChain }: AuctionCardProps) {
  const endTimeSeconds = onChain?.endTime ?? Math.floor(new Date(auction.end_time).getTime() / 1000);
  const description = auction.description || "No description provided.";
  const auctionType = onChain?.auctionType ?? auction.auction_type ?? "sealed";
  const status = onChain?.status ?? fallbackStatus(auction);
  const tokenUnit = auction.token_unit || "USDC";
  const priceLabel =
    auctionType === "dutch"
      ? `Current: ${formatAmount(onChain?.currentDutchPrice ?? onChain?.currentBid ?? auction.start_price, tokenUnit)}`
      : auctionType === "english"
        ? `Highest: ${formatAmount(onChain?.currentBid, tokenUnit)}`
        : `Minimum: ${formatAmount(auction.start_price, tokenUnit)}`;

  return (
    <Link
      href={`/auction/${auction.id}`}
      className="group flex min-h-full flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
      style={{
        border: "1px solid var(--card-border)",
        background: "var(--card-bg)",
        backdropFilter: "blur(16px)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--card-border-hover)";
        e.currentTarget.style.background = "var(--card-bg-hover)";
        e.currentTarget.style.boxShadow = "0 8px 40px rgba(6, 148, 255, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--card-border)";
        e.currentTarget.style.background = "var(--card-bg)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="aspect-[16/10] overflow-hidden" style={{ background: "var(--surface-100)" }}>
        {auction.image_url ? (
          <img
            src={auction.image_url}
            alt={auction.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-sm font-bold uppercase tracking-wider"
            style={{
              background: `linear-gradient(135deg, var(--surface-100), var(--surface-200))`,
              color: "var(--text-tertiary)",
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl opacity-60">
                {auctionType === "sealed" ? "🔒" : auctionType === "english" ? "📈" : "📉"}
              </span>
              {AUCTION_TYPE_LABELS[auctionType]}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <AuctionStatus endTime={endTimeSeconds} status={status} />
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-bold"
            style={{
              background: TYPE_COLORS[auctionType] || "var(--badge-bg)",
              color: TYPE_TEXT_COLORS[auctionType] || "var(--badge-text)",
            }}
          >
            {AUCTION_TYPE_LABELS[auctionType]}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <h2 className="line-clamp-2 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {auction.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl p-3" style={{ background: "var(--badge-bg)" }}>
            <p style={{ color: "var(--text-tertiary)" }}>Auction</p>
            <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>#{auction.contract_auction_id}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--badge-bg)" }}>
            <p style={{ color: "var(--text-tertiary)" }}>Price</p>
            <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>{priceLabel}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
