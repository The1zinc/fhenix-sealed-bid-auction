"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const ARBITRUM_SEPOLIA_CHAIN_HEX = "0x66eee";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  switchToArbitrumSepolia: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchToArbitrumSepolia() {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARBITRUM_SEPOLIA_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      if (switchError?.code !== 4902) {
        throw switchError;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARBITRUM_SEPOLIA_CHAIN_HEX,
            chainName: "Arbitrum Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://sepolia.arbiscan.io"],
          },
        ],
      });
    }
  }

  async function connectWallet() {
    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is required to use this dApp.");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });

      let browserProvider = new BrowserProvider(window.ethereum as any);
      let network = await browserProvider.getNetwork();

      if (Number(network.chainId) !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        await switchToArbitrumSepolia();
        browserProvider = new BrowserProvider(window.ethereum as any);
        network = await browserProvider.getNetwork();
      }

      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);
      setChainId(Number(network.chainId));
      window.localStorage.setItem("sealedAuctionWalletConnected", "true");
    } catch (connectError: any) {
      setError(connectError?.message ?? "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    if (window.localStorage.getItem("sealedAuctionWalletConnected") === "true") {
      void connectWallet();
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setProvider(null);
        setSigner(null);
        window.localStorage.removeItem("sealedAuctionWalletConnected");
        return;
      }

      void connectWallet();
    };

    const handleChainChanged = () => {
      void connectWallet();
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged as any);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged as any);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        provider,
        signer,
        isConnecting,
        error,
        connectWallet,
        switchToArbitrumSepolia,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider.");
  }

  return context;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const { address, chainId, connectWallet, isConnecting, error } = useWallet();
  const wrongNetwork = chainId !== null && chainId !== ARBITRUM_SEPOLIA_CHAIN_ID;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={connectWallet}
        disabled={isConnecting}
        className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting ? "Connecting..." : address ? truncateAddress(address) : "Connect Wallet"}
      </button>
      {wrongNetwork ? <span className="text-xs text-amber-300">Switch to Arbitrum Sepolia</span> : null}
      {error ? <span className="max-w-xs text-right text-xs text-red-300">{error}</span> : null}
    </div>
  );
}
