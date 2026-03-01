import Link from "next/link";

const footerLinks = [
  { href: "/products", label: "Products" },
  { href: "/store-locator", label: "Branches" },
  { href: "/support", label: "Support" },
];

export default function Footer() {
  return (
    <footer className="soft-divider bg-brand-bg">
      <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mobile-surface corner-cut flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="font-heading text-[34px] leading-none text-brand-ink sm:text-[40px]">MDVPRS</p>
            <p className="mt-1 font-body text-xs uppercase tracking-[0.12em] text-brand-muted">Premium Adult Product Catalog</p>
          </div>

          <nav aria-label="Footer links" className="grid grid-cols-2 gap-x-5 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-5">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-sm font-semibold uppercase tracking-[0.08em] text-brand-muted transition hover:text-brand-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3" aria-label="Social links">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="4" />
              <circle cx="12" cy="12" r="3.5" />
              <circle cx="17" cy="7" r="1" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink"
            aria-label="Facebook"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M13.5 8h2V5h-2.3C11 5 10 6.4 10 8.4V10H8v3h2v6h3v-6h2.1l.4-3H13V8.6c0-.5.2-.6.5-.6z" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-sm border border-brand-line text-brand-muted transition hover:border-brand-yellow hover:text-brand-ink"
            aria-label="TikTok"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M16 4c.2 1.4 1.1 2.7 2.5 3.4.8.4 1.7.6 2.5.6v3a8 8 0 0 1-4-1.1V15a6 6 0 1 1-6-6h.3v3H11a3 3 0 1 0 3 3V4h2z" />
            </svg>
          </button>
        </div>

        <p className="font-body text-sm text-brand-muted">
          Warning: This product contains nicotine. Nicotine is an addictive chemical. For adults of legal smoking age only.
        </p>
        <p className="font-body text-sm text-brand-muted">
          {new Date().getFullYear()} MDVPRS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
