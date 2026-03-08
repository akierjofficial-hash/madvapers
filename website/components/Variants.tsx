"use client";

import useScrollReveal from "@/hooks/useScrollReveal";
import { cn } from "@/lib/cn";
import { useMemo, useRef } from "react";

export interface VariantShowcaseItem {
  id: number;
  productName: string;
  variantName: string;
  flavor: string;
  strength: string;
  sku: string;
  capacity: string;
  resistance: string;
  color: string;
  stockOnHand: number;
  priceFrom: number;
}

interface VariantsProps {
  items: VariantShowcaseItem[];
}

const CARD_STYLES = [
  "from-[#0a1628] to-[#0d3060]",
  "from-[#1a0a28] to-[#4a1060]",
  "from-[#281000] to-[#602800]",
  "from-[#002818] to-[#005030]",
  "from-[#281828] to-[#501010]",
  "from-[#051b2c] to-[#1f2f44]",
] as const;

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStock(value: number): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat("en-PH").format(value);
  }
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(value);
}

function VariantCard({ item, index }: { item: VariantShowcaseItem; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isVisible = useScrollReveal(ref);
  const gradientClass = CARD_STYLES[index % CARD_STYLES.length];

  return (
    <article
      ref={ref}
      className={cn(
        "reveal relative overflow-hidden border border-brand-blue/15 bg-dark2 p-5 transition-transform duration-300 hover:-translate-y-1",
        isVisible && "visible",
        `delay-${Math.min(index + 1, 6)}`,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-35", gradientClass)} aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-blue/20 blur-2xl" aria-hidden="true" />

      <div className="relative z-10">
        <p className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-blue">Variant</p>
        <h3 className="mt-1 font-display text-3xl leading-none tracking-[0.03em]">{item.variantName}</h3>
        <p className="mt-2 font-heading text-xs uppercase tracking-[0.12em] text-[#B8BFCE]">{item.productName}</p>

        <div className="mt-4 space-y-1 text-xs text-[#B8BFCE]">
          <p>SKU: {item.sku}</p>
          <p>Flavor: {item.flavor}</p>
          <p>
            Strength: {item.strength} · Capacity: {item.capacity}
          </p>
          <p>
            Resistance: {item.resistance} · Color: {item.color}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-heading text-2xl font-bold text-white">{formatPrice(item.priceFrom)}</p>
          <p
            className={cn(
              "btn-clip border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em]",
              item.stockOnHand <= 0
                ? "border-red-400/50 bg-red-400/10 text-red-300"
                : item.stockOnHand <= 10
                  ? "border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow"
                  : "border-brand-blue/60 bg-brand-blue/10 text-brand-blue",
            )}
          >
            {item.stockOnHand <= 0 ? "Out of stock" : `Stock ${formatStock(item.stockOnHand)}`}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function Variants({ items }: VariantsProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerVisible = useScrollReveal(headerRef);

  const displayItems = useMemo(() => items.slice(0, 8), [items]);

  return (
    <section id="variants" className="bg-dark2 px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div ref={headerRef} className={cn("reveal mb-16 text-center", headerVisible && "visible")}>
          <p className="mb-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue">Live Variants</p>
          <h2 className="font-display text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[0.04em]">
            VARIANT
            <br />
            <span className="text-brand-blue">COLLECTION</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#8890A4]">
            Flavor cards are replaced with real variants from your backend. SKU, flavor, nicotine strength, pricing, and stock are live.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {displayItems.map((item, index) => (
            <VariantCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
