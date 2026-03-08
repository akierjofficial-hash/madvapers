"use client";

import useScrollReveal from "@/hooks/useScrollReveal";
import { cn } from "@/lib/cn";
import { CSSProperties, useMemo, useRef, useState } from "react";

export interface ProductShowcaseItem {
  id: number;
  name: string;
  description: string;
  productType: string;
  category: string;
  brand: string;
  variantCount: number;
  stockOnHand: number;
  priceFrom: number;
  tags: string[];
}

interface ProductCardProps {
  item: ProductShowcaseItem;
  index: number;
}

const GLOW_COLORS = ["#0099FF", "#FFD500", "#FF4A8D", "#00FF88", "#FF6B00", "#66CCFF"] as const;

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

function getCode(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (letters.length === 0) {
    return "MD";
  }
  if (letters.length === 1) {
    return letters[0].slice(0, 2).toUpperCase();
  }
  return `${letters[0][0] ?? "M"}${letters[1][0] ?? "D"}`.toUpperCase();
}

function ProductCard({ item, index }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useScrollReveal(cardRef);
  const [cardTransform, setCardTransform] = useState("translateY(0px) rotateX(0deg) rotateY(0deg)");
  const [cardGradient, setCardGradient] = useState<string>("transparent");

  const glowColor = GLOW_COLORS[index % GLOW_COLORS.length];
  const deviceCode = getCode(item.name);
  const topTag = item.tags[0];

  const infoLabel = `${item.productType} · ${item.variantCount} Variants`;

  const onMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const gx = ((event.clientX - rect.left) / rect.width) * 100;
    const gy = ((event.clientY - rect.top) / rect.height) * 100;

    setCardTransform(`translateY(-8px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`);
    setCardGradient(`radial-gradient(circle at ${gx}% ${gy}%, rgba(0,153,255,0.06) 0%, rgba(19,19,22,1) 62%)`);
  };

  const onLeave = (): void => {
    setCardTransform("translateY(0px) rotateX(0deg) rotateY(0deg)");
    setCardGradient("transparent");
  };

  const style: CSSProperties = {
    transform: cardTransform,
    background: cardGradient,
  };

  return (
    <div
      ref={cardRef}
      className={cn("product-card angular-card reveal overflow-hidden bg-dark2", isVisible && "visible", `delay-${Math.min(index + 1, 6)}`)}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="relative flex h-60 items-center justify-center overflow-hidden bg-dark3">
        <div className="absolute h-36 w-36 rounded-full opacity-40 blur-3xl" style={{ background: glowColor }} />
        <span className="relative z-10 font-display text-7xl tracking-[0.2em]" style={{ color: `${glowColor}33` }}>
          {deviceCode}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-dark2 to-transparent" />
        {topTag ? (
          <span
            className={cn(
              "btn-clip absolute right-4 top-4 px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.18em]",
              topTag === "NEW" || topTag === "BEST" ? "bg-brand-yellow text-black" : "bg-brand-blue text-white",
            )}
          >
            {topTag}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-6">
        <p className="font-heading text-[11px] uppercase tracking-[0.28em] text-brand-blue">{infoLabel}</p>
        <h3 className="font-display text-4xl leading-none tracking-[0.04em]">{item.name}</h3>
        <p className="line-clamp-3 text-sm leading-6 text-[#8890A4]">{item.description}</p>
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-[#B8BFCE]">
          {item.brand} · {item.category}
        </p>

        <div className="flex items-center justify-between pt-2">
          <span className="font-heading text-3xl font-bold">{formatPrice(item.priceFrom)}</span>
          <span
            className={cn(
              "btn-clip border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.14em]",
              item.stockOnHand <= 0
                ? "border-red-400/50 bg-red-400/10 text-red-300"
                : item.stockOnHand <= 20
                  ? "border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow"
                  : "border-brand-blue/60 bg-brand-blue/10 text-brand-blue",
            )}
          >
            {item.stockOnHand <= 0 ? "Out of stock" : `Stock ${formatStock(item.stockOnHand)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ProductsProps {
  items: ProductShowcaseItem[];
}

export default function Products({ items }: ProductsProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerVisible = useScrollReveal(headerRef);

  const displayItems = useMemo(() => items.slice(0, 6), [items]);

  return (
    <section id="products" className="bg-dark px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div
          ref={headerRef}
          className={cn("products-header reveal mb-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between", headerVisible && "visible")}
        >
          <div>
            <p className="mb-3 flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue before:block before:h-px before:w-6 before:bg-brand-blue">
              Live Products
            </p>
            <h2 className="font-display text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[0.04em]">
              PRODUCT
              <br />
              <span className="text-brand-blue">LINEUP</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-[#8890A4] md:text-right">
            Every card below is connected to your backend catalog. Product pricing, stock, category, and variant counts are live.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayItems.map((item, index) => (
            <ProductCard key={`${item.id}-${item.name}`} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
