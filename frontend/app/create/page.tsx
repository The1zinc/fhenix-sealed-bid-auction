"use client";

import Link from "next/link";
import CreateAuctionForm from "@/components/CreateAuctionForm";
import WalletConnect from "@/components/WalletConnect";
import ThemeToggle from "@/components/ThemeToggle";

export default function CreateAuctionPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6 sm:px-8">
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
            <div
              className="mt-3 flex h-7 w-fit items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--accent-subtle)",
                color: "var(--text-brand)",
              }}
            >
              Create
            </div>
            <h1
              className="mt-3 text-4xl font-black tracking-tight sm:text-5xl"
              style={{ color: "var(--text-primary)" }}
            >
              New <span className="gradient-text">Auction</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />

      <section className="mt-8 animate-slide-up">
        <CreateAuctionForm />
      </section>
    </main>
  );
}
