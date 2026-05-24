"use client";

import { useEffect, useState } from "react";
import { AUCTION_STATUS_LABELS, type ContractAuctionStatus } from "@/lib/contract";

type AuctionStatusProps = {
  endTime: number;
  status: ContractAuctionStatus;
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

const STATUS_STYLES: Record<ContractAuctionStatus, { bg: string; border: string; text: string; dot: string }> = {
  active: {
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
    text: "#10b981",
    dot: "#10b981",
  },
  ended: {
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.25)",
    text: "#f59e0b",
    dot: "#f59e0b",
  },
  finalized: {
    bg: "rgba(99, 102, 241, 0.1)",
    border: "rgba(99, 102, 241, 0.25)",
    text: "#6366f1",
    dot: "#6366f1",
  },
};

export default function AuctionStatus({ endTime, status }: AuctionStatusProps) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(endTime));

  useEffect(() => {
    setRemaining(getRemainingSeconds(endTime));
    const timer = window.setInterval(() => setRemaining(getRemainingSeconds(endTime)), 1000);
    return () => window.clearInterval(timer);
  }, [endTime]);

  const effectiveStatus: ContractAuctionStatus = status === "active" && remaining === 0 ? "ended" : status;
  const styles = STATUS_STYLES[effectiveStatus];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase"
        style={{
          background: styles.bg,
          border: `1px solid ${styles.border}`,
          color: styles.text,
        }}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${effectiveStatus === "active" ? "animate-pulse" : ""}`}
          style={{ background: styles.dot }}
        />
        {AUCTION_STATUS_LABELS[effectiveStatus]}
      </span>
      {effectiveStatus === "active" ? (
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {formatRemaining(remaining)} remaining
        </span>
      ) : effectiveStatus === "ended" ? (
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Awaiting finalization</span>
      ) : null}
    </div>
  );
}
