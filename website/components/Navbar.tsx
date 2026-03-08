"use client";

import useNavScroll from "@/hooks/useNavScroll";
import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/#products", label: "Products" },
  { href: "/#variants", label: "Variants" },
  { href: "/#lifestyle", label: "Lifestyle" },
  { href: "/#testimonials", label: "Reviews" },
  { href: "/#branches", label: "Branches" },
];

export default function Navbar() {
  const isScrolled = useNavScroll();

  return (
    <header className="fixed left-0 right-0 top-0 z-[1000]">
      <nav
        className={cn(
          "mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 transition-all duration-300 sm:px-8 lg:px-14",
          isScrolled
            ? "border-b border-brand-blue/10 bg-black/90 py-3 backdrop-blur-xl"
            : "bg-transparent py-5",
        )}
      >
        <Link href="/#hero" className="group inline-flex items-center">
          <Image
            src="/logo.png"
            alt="MDVPRS Logo"
            width={170}
            height={50}
            className="h-11 w-auto object-contain drop-shadow-[0_0_12px_rgba(0,153,255,0.45)] transition-[filter] duration-300 group-hover:drop-shadow-[0_0_20px_rgba(0,153,255,0.75)]"
            priority
          />
        </Link>

        <ul className="hidden list-none items-center gap-9 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="relative font-heading text-sm uppercase tracking-[0.18em] text-[#B8BFCE] transition-colors duration-300 hover:text-white after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 after:bg-brand-blue after:transition-[width] after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <a
          href="/#products"
          className="btn-clip inline-flex items-center border-[1.5px] border-brand-blue px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-blue transition-all duration-300 hover:bg-brand-blue hover:text-black hover:shadow-[0_0_24px_rgba(0,153,255,0.4)] sm:px-7"
        >
          Catalog
        </a>
      </nav>
    </header>
  );
}

