"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { Product } from "@/lib/products";

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

  return (
    <div className="page-wrap space-y-8">
      <SectionHeader title={title} subtitleJa={subtitleJa} description={description} />

      <section className="sticker-panel grunge-paper corner-cut p-4" aria-label="Catalog filters">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-brand-muted">
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sticker-input"
              placeholder="Flavor or product"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-brand-muted">
            Nicotine
            <select value={selectedStrength} onChange={(event) => setSelectedStrength(event.target.value)} className="sticker-input">
              {strengthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-brand-muted">
            Flavor
            <select value={selectedFlavor} onChange={(event) => setSelectedFlavor(event.target.value)} className="sticker-input">
              {flavorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs uppercase tracking-[0.14em] text-brand-muted">
            Device
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="sticker-input">
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section aria-live="polite" className="space-y-4">
        <p className="inline-flex border border-brand-line bg-brand-surface px-3 py-1 text-sm uppercase tracking-[0.08em] text-brand-muted">
          {filteredProducts.length} results
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="sticker-card corner-cut p-6 text-center">
            <p className="font-heading text-6xl uppercase text-brand-ink">No Match</p>
            <p className="text-base text-brand-muted">Try broader filters.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
