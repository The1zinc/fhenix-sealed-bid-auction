import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WalletProvider } from "@/components/WalletConnect";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Confidential Auction dApp · Fhenix CoFHE",
  description:
    "Sealed-bid, English, and Dutch auctions powered by Fhenix CoFHE on Arbitrum Sepolia. Deploy, bid, and reveal winners with fully homomorphic encryption.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.className} dark`} suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply dark class before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("fhenix-auction-theme");var d=t==="light"?"light":t==="dark"?"dark":window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",d==="dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <WalletProvider>{children}</WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
