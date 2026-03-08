import Link from "next/link";
import type { Product } from "@/lib/products";

type ProductCardProps = {
  product: Product;
};

function formatStock(value: number): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat("en-PH").format(value);
  }
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

export default function ProductCard({ product }: ProductCardProps) {
  const primaryTag = product.tags[0] ?? "NEW";
  const flavorNote = product.flavorNotes[0] ?? product.notes;
  const glowColor =
    product.heroTone === "yellow"
      ? "rgba(255,213,0,0.35)"
      : product.heroTone === "ink"
        ? "rgba(184,191,206,0.28)"
        : "rgba(0,153,255,0.35)";

  return (
    <article className="angular-card group relative overflow-hidden border border-brand-blue/15 bg-dark2 p-4 transition-all duration-300 hover:-translate-y-1.5">
      <div className="relative mb-4 h-56 overflow-hidden border border-white/10 bg-dark3">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl"
          style={{ background: glowColor }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-[-8%] h-28 w-28 rounded-full blur-2xl"
          style={{ background: glowColor }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="btn-clip border border-brand-yellow/40 bg-brand-yellow/15 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.14em] text-brand-yellow">
            {primaryTag}
          </span>
          <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">{product.deviceType}</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-display text-[40px] leading-none tracking-[0.03em] text-white/10">{product.productName ?? product.name}</p>
        </div>
      </div>

      <p className="mb-1 font-heading text-[11px] uppercase tracking-[0.2em] text-brand-blue">{product.category}</p>
      <h3 className="font-display text-[30px] leading-[0.95] tracking-[0.02em] text-white">{product.name}</h3>
      <p className="mt-2 text-sm leading-7 text-[#B8BFCE]">{flavorNote}</p>
      <p className="mt-3 font-heading text-xs uppercase tracking-[0.12em] text-[#8890A4]">
        {product.strength} • {product.flavorCategory}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="font-heading text-2xl font-bold text-white">PHP {product.priceFrom}</p>
        <Link
          href={`/products/${product.slug}`}
          className="btn-clip inline-flex items-center border border-brand-blue px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-blue transition-all duration-300 hover:bg-brand-blue hover:text-black"
        >
          View Product
        </Link>
      </div>

      <p
        className={[
          "mt-3 inline-flex btn-clip border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em]",
          (product.stockOnHand ?? 0) <= 0
            ? "border-red-400/50 bg-red-400/10 text-red-300"
            : (product.stockOnHand ?? 0) <= 10
              ? "border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow"
              : "border-brand-blue/60 bg-brand-blue/10 text-brand-blue",
        ].join(" ")}
      >
        {(product.stockOnHand ?? 0) <= 0
          ? "Out of stock"
          : `Stock ${formatStock(product.stockOnHand ?? 0)}`}
      </p>

      <Link href={`/products/${product.slug}`} className="sr-only">
        Open {product.name}
      </Link>
    </article>
  );
}
