"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type NavbarSearchItem = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  kind: "page" | "product" | "branch";
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/store-locator", label: "Branches" },
  { href: "/support", label: "Support" },
];

const defaultSearchItems: NavbarSearchItem[] = [
  { id: "page-home", label: "Home", sublabel: "Main page", href: "/", kind: "page" },
  { id: "page-products", label: "Products", sublabel: "Product catalog", href: "/products", kind: "page" },
  { id: "page-branches", label: "Branches", sublabel: "Store locations", href: "/store-locator", kind: "page" },
  { id: "page-support", label: "Support", sublabel: "Help and FAQ", href: "/support", kind: "page" },
];

function kindLabel(kind: NavbarSearchItem["kind"]): string {
  if (kind === "product") return "Product";
  if (kind === "branch") return "Branch";
  return "Page";
}

export default function Navbar({ searchItems = defaultSearchItems }: { searchItems?: NavbarSearchItem[] }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mergedSearchItems = useMemo(() => {
    const map = new Map<string, NavbarSearchItem>();
    for (const item of [...defaultSearchItems, ...searchItems]) {
      if (!item?.id || !item?.href || !item?.label) continue;
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [searchItems]);

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const rank = (item: NavbarSearchItem): number => {
      const label = item.label.toLowerCase();
      const sub = (item.sublabel ?? "").toLowerCase();
      if (label === q) return 0;
      if (label.startsWith(q)) return 1;
      if (sub.startsWith(q)) return 2;
      return 9;
    };

    if (!q) {
      return mergedSearchItems.slice(0, 8);
    }

    return mergedSearchItems
      .filter((item) => {
        const label = item.label.toLowerCase();
        const sub = (item.sublabel ?? "").toLowerCase();
        return label.startsWith(q) || sub.startsWith(q);
      })
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 10);
  }, [mergedSearchItems, searchQuery]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    const shouldLockScroll = mobileOpen || searchOpen;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        return;
      }

      if (event.key === "Enter" && filteredSearchItems.length > 0) {
        const first = filteredSearchItems[0];
        setSearchOpen(false);
        router.push(first.href);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, filteredSearchItems, router]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [searchOpen]);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const navLinkClass =
    "relative py-1 font-body text-sm font-semibold uppercase tracking-[0.1em] text-brand-muted transition-colors hover:text-brand-ink";

  const openSearch = () => {
    setMobileOpen(false);
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
  };

  const onSuggestionClick = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header className="sticky top-0 z-[70] border-b border-brand-line bg-brand-bg/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-brand-yellow/30" aria-hidden="true" />
      <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="MDVPRS home">
          <Image
            src="/logo.png"
            alt="MDVPRS logo"
            width={210}
            height={60}
            className="h-9 w-auto object-contain sm:h-11"
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
            aria-label="Open website search"
            aria-expanded={searchOpen}
            onClick={openSearch}
            className="grid h-9 w-9 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <span className="rounded-sm border border-brand-yellow bg-brand-yellow px-2 py-1 font-body text-xs font-semibold uppercase tracking-[0.08em] text-black">
            21+
          </span>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="grid h-9 w-9 place-items-center rounded-sm border border-brand-line text-brand-ink transition hover:border-brand-yellow hover:text-brand-yellow md:hidden"
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="2">
                <path d="m6 6 12 12" />
                <path d="m18 6-12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="2">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden",
          "fixed inset-0 top-[68px] z-[69] transition duration-200 sm:top-[72px]",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Close mobile menu backdrop"
          onClick={() => setMobileOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        />
        <nav
          aria-label="Primary mobile"
          className={cn(
            "absolute left-0 right-0 top-0 mx-4 mt-3 overflow-hidden border border-brand-line bg-brand-surface shadow-sticker transition-transform duration-200",
            mobileOpen ? "translate-y-0" : "-translate-y-2",
          )}
        >
          <div className="border-b border-brand-line px-4 py-3 text-xs uppercase tracking-[0.14em] text-brand-muted">Menu</div>
          <div className="p-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center border border-transparent px-3 py-3 font-body text-sm font-semibold uppercase tracking-[0.08em] text-brand-muted transition",
                  "hover:border-brand-line hover:bg-brand-bg hover:text-brand-ink",
                  isActive(item.href) && "border-brand-line bg-brand-bg text-brand-ink",
                )}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[88] transition duration-200",
          searchOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Close search backdrop"
          onClick={closeSearch}
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-label="Website search"
          className="absolute left-4 right-4 top-[78px] mx-auto w-auto max-w-2xl overflow-hidden border border-brand-line bg-brand-surface shadow-sticker sm:top-[84px]"
        >
          <div className="flex items-center gap-2 border-b border-brand-line px-3 py-3">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 stroke-brand-muted" fill="none" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products, branches, pages..."
              className="h-9 w-full bg-transparent font-body text-sm text-brand-ink placeholder:text-brand-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="grid h-8 w-8 place-items-center border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2">
                <path d="m6 6 12 12" />
                <path d="m18 6-12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-2">
            {filteredSearchItems.length === 0 ? (
              <p className="px-3 py-8 text-center font-body text-sm text-brand-muted">No results found for "{searchQuery}".</p>
            ) : (
              <ul className="space-y-1">
                {filteredSearchItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onSuggestionClick}
                      className="flex items-center justify-between gap-3 border border-transparent px-3 py-2.5 transition hover:border-brand-line hover:bg-brand-bg"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm font-semibold uppercase tracking-[0.06em] text-brand-ink">{item.label}</p>
                        {item.sublabel ? <p className="truncate font-body text-xs text-brand-muted">{item.sublabel}</p> : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 border px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em]",
                          item.kind === "product" && "border-brand-yellow/60 text-brand-yellow",
                          item.kind === "branch" && "border-brand-line text-brand-ink",
                          item.kind === "page" && "border-brand-line text-brand-muted",
                        )}
                      >
                        {kindLabel(item.kind)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </header>
  );
}
