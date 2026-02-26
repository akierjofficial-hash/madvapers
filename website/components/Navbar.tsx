"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/store-locator", label: "Branches" },
  { href: "/support", label: "Support" },
];

export default function Navbar() {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const navLinkClass =
    "relative py-1 font-body text-sm font-semibold uppercase tracking-[0.08em] text-brand-muted transition-colors hover:text-brand-ink";

  return (
    <header className="sticky top-0 z-[70] border-b border-brand-line bg-brand-bg/95 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-brand-yellow/30" aria-hidden="true" />
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="MDVPRS home">
          <Image
            src="/logo.png"
            alt="MDVPRS logo"
            width={210}
            height={60}
            className="h-10 w-auto object-contain sm:h-11"
            priority
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                navLinkClass,
                isActive(item.href) &&
                  "text-brand-ink after:absolute after:-bottom-[23px] after:left-0 after:h-[2px] after:w-full after:bg-brand-yellow after:content-['']",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            className="hidden h-8 w-8 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink sm:grid"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Profile"
            className="hidden h-8 w-8 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink sm:grid"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c2-4 5-6 8-6s6 2 8 6" />
            </svg>
          </button>
          <span className="rounded-sm border border-brand-yellow bg-brand-yellow px-2 py-1 font-body text-xs font-semibold uppercase tracking-[0.08em] text-black">
            21+
          </span>
        </div>
      </div>

      <div className="border-t border-brand-line md:hidden">
        <nav aria-label="Primary mobile" className="mx-auto w-full max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max items-center gap-5 py-2.5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={cn(navLinkClass, isActive(item.href) && "text-brand-ink")}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
