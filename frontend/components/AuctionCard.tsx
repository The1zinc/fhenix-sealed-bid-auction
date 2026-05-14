"use client";

import Link from "next/link";
import type { AuctionRow } from "@/lib/supabase";
import AuctionStatus from "./AuctionStatus";

type AuctionCardProps = {
  auction: AuctionRow;
};

export default function AuctionCard({ auction }: AuctionCardProps) {
  const endTimeSeconds = Math.floor(new Date(auction.end_time).getTime() / 1000);
  const description = auction.description || "No description provided.";

  return (
    <Link
      href={`/auction/${auction.id}`}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-glow transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.09]"
    >
      <div className="aspect-[16/10] overflow-hidden bg-slate-900">
        {auction.image_url ? (
          <img
            src={auction.image_url}
            alt={auction.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#334155,#020617)] text-sm uppercase tracking-[0.35em] text-slate-400">
            Sealed Auction
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <AuctionStatus
          endTime={endTimeSeconds}
          closed={Boolean(auction.is_closed)}
          settled={Boolean(auction.is_settled)}
        />
        <div>
          <h2 className="text-xl font-semibold text-white">{auction.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <div className="text-xs text-slate-400">Auction #{auction.contract_auction_id}</div>
      </div>
    </Link>
  );
}
