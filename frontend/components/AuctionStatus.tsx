"use client";

import { useEffect, useState } from "react";

type AuctionStatusProps = {
  endTime: number;
  closed: boolean;
  settled: boolean;
};

function getRemainingSeconds(endTime: number) {
  return Math.max(0, Math.floor(endTime - Date.now() / 1000));
}

function formatRemaining(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export default function AuctionStatus({ endTime, closed, settled }: AuctionStatusProps) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(endTime));

  useEffect(() => {
    setRemaining(getRemainingSeconds(endTime));
    const timer = window.setInterval(() => setRemaining(getRemainingSeconds(endTime)), 1000);
    return () => window.clearInterval(timer);
  }, [endTime]);

  const status = settled ? "SETTLED" : closed ? "CLOSED" : "LIVE";
  const statusClass = settled
    ? "border-purple-300/50 bg-purple-400/15 text-purple-100"
    : closed
      ? "border-amber-300/50 bg-amber-400/15 text-amber-100"
      : "border-emerald-300/50 bg-emerald-400/15 text-emerald-100";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-[0.2em] ${statusClass}`}>
        {status}
      </span>
      {!closed && !settled ? (
        <span className="text-sm text-slate-300">{remaining > 0 ? `${formatRemaining(remaining)} remaining` : "Ended"}</span>
      ) : null}
    </div>
  );
}
