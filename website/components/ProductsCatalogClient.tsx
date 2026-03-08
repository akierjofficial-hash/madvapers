"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";

const allOption = "All";

type ProductsCatalogClientProps = {
  products: Product[];
  title?: string;
  subtitleJa?: string;
  description?: string;
};

export default function ProductsCatalogClient({
  products,
  title = "Products",
  subtitleJa = "catalog",
  description = "Filter by nicotine strength, flavor category, and device type.",
}: ProductsCatalogClientProps) {
  const [selectedStrength, setSelectedStrength] = useState(allOption);
  const [selectedFlavor, setSelectedFlavor] = useState(allOption);
  const [selectedType, setSelectedType] = useState(allOption);
  const [query, setQuery] = useState("");

  const strengthOptions = useMemo(
    () => [allOption, ...Array.from(new Set(products.map((product) => product.strength))).filter(Boolean)],
    [products],
  );
  const flavorOptions = useMemo(
    () => [allOption, ...Array.from(new Set(products.map((product) => product.flavorCategory))).filter(Boolean)],
    [products],
  );
  const typeOptions = useMemo(
    () => [allOption, ...Array.from(new Set(products.map((product) => product.deviceType))).filter(Boolean)],
    [products],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesStrength = selectedStrength === allOption || product.strength === selectedStrength;
      const matchesFlavor = selectedFlavor === allOption || product.flavorCategory === selectedFlavor;
      const matchesType = selectedType === allOption || product.deviceType === selectedType;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.jpName.toLowerCase().includes(normalizedQuery) ||
        product.notes.toLowerCase().includes(normalizedQuery);
      return matchesStrength && matchesFlavor && matchesType && matchesQuery;
    });
  }, [products, query, selectedFlavor, selectedStrength, selectedType]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    selectedStrength !== allOption ||
    selectedFlavor !== allOption ||
    selectedType !== allOption;

  const resetFilters = () => {
    setQuery("");
    setSelectedStrength(allOption);
    setSelectedFlavor(allOption);
    setSelectedType(allOption);
  };

  return (
    <section className="relative overflow-hidden bg-dark px-5 pb-16 pt-8 sm:px-8 lg:px-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 18%, rgba(0,153,255,0.08) 0%, transparent 72%), radial-gradient(ellipse 35% 35% at 84% 76%, rgba(255,213,0,0.05) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-[1400px]">
        <header className="mb-10">
          <p className="mb-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue">{subtitleJa}</p>
          <h1 className="font-display text-[clamp(52px,7vw,96px)] leading-[0.9] tracking-[0.04em]">
            PRODUCT
            <br />
            <span className="text-brand-blue">{title.toUpperCase()}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-[#8890A4]">{description}</p>
        </header>

        <section className="mb-8 border border-brand-blue/15 bg-dark2 p-5 sm:p-6" aria-label="Catalog filters">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <p className="font-heading text-xs uppercase tracking-[0.2em] text-[#B8BFCE]">Filters</p>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="btn-clip border border-white/20 px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-[#B8BFCE] transition-all duration-300 hover:border-brand-yellow hover:text-brand-yellow disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="block font-heading text-[11px] uppercase tracking-[0.16em] text-[#B8BFCE]">Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full border border-white/15 bg-dark px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-blue"
                placeholder="Flavor, name, or note"
              />
            </label>

            <label className="space-y-2">
              <span className="block font-heading text-[11px] uppercase tracking-[0.16em] text-[#B8BFCE]">Nicotine</span>
              <select
                value={selectedStrength}
                onChange={(event) => setSelectedStrength(event.target.value)}
                className="w-full border border-white/15 bg-dark px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-blue"
              >
                {strengthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block font-heading text-[11px] uppercase tracking-[0.16em] text-[#B8BFCE]">Flavor</span>
              <select
                value={selectedFlavor}
                onChange={(event) => setSelectedFlavor(event.target.value)}
                className="w-full border border-white/15 bg-dark px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-blue"
              >
                {flavorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block font-heading text-[11px] uppercase tracking-[0.16em] text-[#B8BFCE]">Device</span>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                className="w-full border border-white/15 bg-dark px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-blue"
              >
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section aria-live="polite" className="space-y-5">
          <p className="inline-flex border border-brand-blue/35 bg-dark2 px-3 py-1.5 font-heading text-xs uppercase tracking-[0.15em] text-brand-blue">
            {filteredProducts.length} Results
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="border border-white/15 bg-dark2 p-8 text-center">
              <p className="font-display text-[clamp(42px,6vw,72px)] leading-[0.9] tracking-[0.04em] text-white">NO MATCH</p>
              <p className="mt-2 text-sm text-[#B8BFCE]">Try broader filters.</p>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
