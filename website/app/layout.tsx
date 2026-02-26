import type { Metadata } from "next";
import { Bebas_Neue, Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import AgeGateModal from "@/components/AgeGateModal";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RouteNavigationLoader from "@/components/RouteNavigationLoader";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MDVPRS | Premium Vape Brand",
  description:
    "MDVPRS public website with clean industrial style, product catalog, branch locator, support, and compliance-first content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebas.variable} ${inter.variable} ${notoSansJp.variable} bg-brand-bg font-body text-brand-ink`}
      >
        <a
          href="#main-content"
          className="sr-only left-4 top-4 z-[90] border border-brand-yellow bg-black px-3 py-2 text-sm font-semibold text-brand-yellow focus:not-sr-only focus:fixed"
        >
          Skip to content
        </a>
        <AgeGateModal />
        <Suspense fallback={null}>
          <RouteNavigationLoader />
        </Suspense>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
