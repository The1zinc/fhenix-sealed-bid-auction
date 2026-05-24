"use client";

import { BrowserProvider, ContractFactory } from "ethers";
import Link from "next/link";
import { useEffect, useState } from "react";
import WalletConnect, { useWallet } from "@/components/WalletConnect";
import ThemeToggle from "@/components/ThemeToggle";
import { BLIND_AUCTION_ABI, getDeployedAddress, setDeployedAddress } from "@/lib/contract";
import { BLIND_AUCTION_BYTECODE } from "@/lib/bytecode";

type DeployStep = "idle" | "deploying" | "confirming" | "done" | "error";

const EXPLORER_BASE = "https://sepolia.arbiscan.io";

const STEPS_INFO = [
  { label: "Connect Wallet", description: "Connect your MetaMask wallet to Arbitrum Sepolia" },
  { label: "Deploy", description: "Sign the deployment transaction in MetaMask" },
  { label: "Confirm", description: "Wait for the transaction to be confirmed on-chain" },
  { label: "Done", description: "Contract deployed and ready to use" },
];

function getActiveStepIndex(step: DeployStep, hasAddress: boolean): number {
  if (hasAddress || step === "done") return 3;
  if (step === "confirming") return 2;
  if (step === "deploying") return 1;
  return 0;
}

export default function DeployPage() {
  const { signer, address, connectWallet } = useWallet();
  const [step, setStep] = useState<DeployStep>("idle");
  const [deployedAddr, setDeployedAddr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gasUsed, setGasUsed] = useState<string | null>(null);

  useEffect(() => {
    const existing = getDeployedAddress();
    if (existing) {
      setDeployedAddr(existing);
    }
  }, []);

  async function getActiveSigner() {
    if (signer && address) {
      return signer;
    }

    await connectWallet();

    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    const provider = new BrowserProvider(window.ethereum as any);
    return provider.getSigner();
  }

  async function handleDeploy() {
    setStep("deploying");
    setError(null);
    setTxHash(null);
    setGasUsed(null);

    try {
      const activeSigner = await getActiveSigner();
      const factory = new ContractFactory(BLIND_AUCTION_ABI, BLIND_AUCTION_BYTECODE, activeSigner);

      setStep("confirming");
      const contract = await factory.deploy();
      const tx = contract.deploymentTransaction();
      if (tx) {
        setTxHash(tx.hash);
      }

      const receipt = await tx?.wait();
      const contractAddress = await contract.getAddress();

      if (receipt) {
        setGasUsed(receipt.gasUsed.toString());
      }

      setDeployedAddress(contractAddress);
      setDeployedAddr(contractAddress);
      setStep("done");
    } catch (deployError: any) {
      setError(deployError?.shortMessage || deployError?.message || "Deployment failed.");
      setStep("error");
    }
  }

  function handleReset() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("blindAuctionAddress");
    }
    setDeployedAddr(null);
    setStep("idle");
    setTxHash(null);
    setGasUsed(null);
    setError(null);
  }

  const activeStepIndex = getActiveStepIndex(step, !!deployedAddr);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6 sm:px-8">
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
            <div
              className="mt-3 flex h-7 w-fit items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--accent-subtle)",
                color: "var(--text-brand)",
              }}
            >
              Deploy
            </div>
            <h1
              className="mt-3 text-4xl font-black tracking-tight sm:text-5xl"
              style={{ color: "var(--text-primary)" }}
            >
              Contract <span className="gradient-text">Deployment</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm" style={{ color: "var(--text-secondary)" }}>
              Deploy the BlindAuction smart contract to Arbitrum Sepolia via MetaMask. The contract address is saved locally for this app.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />

      <section className="mt-8 space-y-6 animate-slide-up">
        {/* Network Info Grid */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(16px)",
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            🌐 Target Network
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Network</p>
              <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>Arbitrum Sepolia</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Chain ID</p>
              <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>421614</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--badge-bg)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Auction types</p>
              <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>Sealed, English, Dutch</p>
            </div>
          </div>
        </div>

        {/* Deployment Progress Steps */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(16px)",
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            📋 Deployment Steps
          </h2>
          <div className="mt-5 flex flex-col gap-1">
            {STEPS_INFO.map((s, i) => {
              const isActive = i === activeStepIndex;
              const isCompleted = i < activeStepIndex;
              const isPending = i > activeStepIndex;

              return (
                <div
                  key={s.label}
                  className="flex items-start gap-4 rounded-xl p-3 transition-all duration-300"
                  style={{
                    background: isActive ? "var(--accent-subtle)" : "transparent",
                  }}
                >
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                    style={{
                      background: isCompleted
                        ? "#10b981"
                        : isActive
                          ? "var(--accent)"
                          : "var(--badge-bg)",
                      color: isCompleted || isActive ? "#fff" : "var(--text-tertiary)",
                      boxShadow: isActive ? "0 0 12px rgba(6, 148, 255, 0.3)" : "none",
                    }}
                  >
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : isActive && (step === "deploying" || step === "confirming") ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: isPending ? "var(--text-tertiary)" : "var(--text-primary)",
                      }}
                    >
                      {s.label}
                    </p>
                    <p
                      className="text-xs"
                      style={{
                        color: isPending ? "var(--text-tertiary)" : "var(--text-secondary)",
                        opacity: isPending ? 0.6 : 1,
                      }}
                    >
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deployed Contract Info */}
        {deployedAddr ? (
          <div
            className="rounded-2xl p-6 animate-slide-up"
            style={{
              background: "var(--success-bg)",
              border: "1px solid var(--success-border)",
            }}
          >
            <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--success-text)" }}>
              <span className="text-xl">✅</span>
              Contract Deployed
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Contract address</p>
                <p
                  className="mt-1 break-all rounded-lg p-2 font-mono text-sm font-bold"
                  style={{
                    background: "var(--badge-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  {deployedAddr}
                </p>
              </div>
              {txHash ? (
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Deploy transaction</p>
                  <a
                    href={`${EXPLORER_BASE}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all font-mono text-xs transition-opacity hover:opacity-80"
                    style={{ color: "var(--text-brand)" }}
                  >
                    {txHash} ↗
                  </a>
                </div>
              ) : null}
              {gasUsed ? (
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Gas used</p>
                  <p className="mt-1 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                    {Number(gasUsed).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div
            className="flex items-start gap-3 rounded-2xl p-5 animate-fade-in"
            style={{
              background: "var(--error-bg)",
              border: "1px solid var(--error-border)",
            }}
          >
            <span className="text-lg">❌</span>
            <p className="text-sm" style={{ color: "var(--error-text)" }}>{error}</p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {!deployedAddr ? (
            <button
              type="button"
              onClick={handleDeploy}
              disabled={step === "deploying" || step === "confirming"}
              className="flex-1 rounded-xl px-6 py-4 font-black transition-all duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
                boxShadow: "0 4px 20px rgba(6, 148, 255, 0.3)",
              }}
            >
              {step === "deploying" || step === "confirming" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deploying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Deploy Contract
                </span>
              )}
            </button>
          ) : (
            <>
              <Link
                href="/create"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-4 font-black transition-all duration-200 hover:scale-[1.01]"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  boxShadow: "0 4px 20px rgba(6, 148, 255, 0.3)",
                }}
              >
                ✨ Create First Auction
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl px-6 py-4 font-bold transition-all duration-200 hover:scale-[1.01]"
                style={{
                  border: "1px solid var(--border-default)",
                  background: "var(--card-bg)",
                  color: "var(--text-secondary)",
                }}
              >
                Deploy New Contract
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
