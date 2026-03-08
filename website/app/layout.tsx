import type { Metadata } from "next";
import { Bebas_Neue, Rajdhani, Space_Grotesk } from "next/font/google";
import Cursor from "@/components/Cursor";
import Loader from "@/components/Loader";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MDVPRS — ?????? | Premium Vape",
  description:
    "MDVPRS premium vape landing page. Street-luxury visuals, futuristic UI, and Japanese streetwear-inspired identity.",
  openGraph: {
    title: "MDVPRS — ?????? | Premium Vape",
    description:
      "Born from the streets. Refined for the elite. Premium vapor experiences engineered for those who demand more from every draw.",
    type: "website",
    images: [
      {
        url: "/website.jpg",
        width: 1200,
        height: 630,
        alt: "MDVPRS premium landing",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${rajdhani.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-dark font-body text-white antialiased">
        <Loader />
        <Cursor />
        {children}
      </body>
    </html>
  );
}

