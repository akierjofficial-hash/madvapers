import type { Metadata } from "next";
import { Bebas_Neue, Inter, Noto_Sans_JP } from "next/font/google";
import { Suspense } from "react";
import AgeGateModal from "@/components/AgeGateModal";
import Footer from "@/components/Footer";
import Navbar, { type NavbarSearchItem } from "@/components/Navbar";
import RouteNavigationLoader from "@/components/RouteNavigationLoader";
import { getPublicBranches } from "@/lib/publicBranches";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [products, branches] = await Promise.all([getPublicCatalogProducts(), getPublicBranches()]);

  const searchItems: NavbarSearchItem[] = [
    { id: "page-home", label: "Home", sublabel: "Main page", href: "/", kind: "page" },
    { id: "page-products", label: "Products", sublabel: "Product catalog", href: "/products", kind: "page" },
    { id: "page-branches", label: "Branches", sublabel: "Store locations", href: "/store-locator", kind: "page" },
    { id: "page-support", label: "Support", sublabel: "Help and FAQ", href: "/support", kind: "page" },
    ...products.slice(0, 180).map((product) => ({
      id: `product-${product.id}`,
      label: product.name,
      sublabel: `${product.deviceType} • ${product.strength}`,
      href: `/products/${product.slug}`,
      kind: "product" as const,
    })),
    ...branches.map((branch) => ({
      id: `branch-${branch.id}`,
      label: branch.name,
      sublabel: branch.locator ?? branch.address ?? branch.code,
      href: `/store-locator#branch-${branch.id}`,
      kind: "branch" as const,
    })),
  ];

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
          <Navbar searchItems={searchItems} />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
