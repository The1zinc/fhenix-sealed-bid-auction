import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletConnect";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sealed-Bid Confidential Auction",
  description: "Confidential sealed-bid auctions powered by Fhenix CoFHE on Arbitrum Sepolia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
