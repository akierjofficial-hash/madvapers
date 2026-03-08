import CtaSection from "@/components/CtaSection";
import BranchesSection from "@/components/BranchesSection";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Lifestyle from "@/components/Lifestyle";
import Marquee from "@/components/Marquee";
import Navbar from "@/components/Navbar";
import Products, { type ProductShowcaseItem } from "@/components/Products";
import Testimonials from "@/components/Testimonials";
import Variants, { type VariantShowcaseItem } from "@/components/Variants";
import WhySection from "@/components/WhySection";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";
import { getPublicBranches } from "@/lib/publicBranches";
import { getPublicReviews } from "@/lib/publicReviews";
import type { Product } from "@/lib/products";

type ProductGroup = {
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
};

type ReviewVariantOption = {
  id: number;
  label: string;
};

function getBaseName(product: Product): string {
  if (product.productName && product.productName.trim()) {
    return product.productName.trim();
  }
  const [base] = product.name.split(" - ");
  return base?.trim() || product.name;
}

function buildProductGroups(items: Product[]): ProductGroup[] {
  const groups = new Map<number, ProductGroup>();

  for (const item of items) {
    const key = item.productId ?? item.id;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        name: getBaseName(item),
        description: item.notes,
        productType: item.productType ?? item.deviceType,
        category: item.categoryName ?? item.category,
        brand: item.brandName ?? "MDVPRS",
        variantCount: 1,
        stockOnHand: Math.max(0, item.stockOnHand ?? 0),
        priceFrom: item.priceFrom,
        tags: [...item.tags],
      });
      continue;
    }

    existing.variantCount += 1;
    existing.stockOnHand += Math.max(0, item.stockOnHand ?? 0);
    existing.priceFrom = Math.min(existing.priceFrom, item.priceFrom);
    if ((!existing.description || existing.description.length < 20) && item.notes) {
      existing.description = item.notes;
    }
    for (const tag of item.tags) {
      if (!existing.tags.includes(tag)) {
        existing.tags.push(tag);
      }
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.variantCount - a.variantCount || a.priceFrom - b.priceFrom)
    .slice(0, 12);
}

function buildVariantItems(items: Product[]): VariantShowcaseItem[] {
  return items.slice(0, 20).map((item) => ({
    id: item.id,
    productName: getBaseName(item),
    variantName: item.variantName?.trim() || item.name,
    flavor: item.flavor?.trim() || "N/A",
    strength: item.strength,
    sku: item.sku?.trim() || `SKU-${item.id}`,
    capacity: item.specs.find((spec) => spec.label.toLowerCase() === "capacity")?.value || "N/A",
    resistance: item.specs.find((spec) => spec.label.toLowerCase() === "resistance")?.value || "N/A",
    color: item.specs.find((spec) => spec.label.toLowerCase() === "color")?.value || "N/A",
    stockOnHand: Math.max(0, item.stockOnHand ?? 0),
    priceFrom: item.priceFrom,
  }));
}

function buildReviewVariantOptions(items: Product[]): ReviewVariantOption[] {
  const map = new Map<number, ReviewVariantOption>();

  for (const item of items) {
    const variantId = item.id;
    if (map.has(variantId)) {
      continue;
    }

    const variantName = item.variantName?.trim() || item.flavor?.trim() || "Variant";
    const baseName = getBaseName(item);
    map.set(variantId, {
      id: variantId,
      label: `${baseName} - ${variantName}`,
    });
  }

  return Array.from(map.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 80);
}

export default async function HomePage() {
  const catalogItems = await getPublicCatalogProducts();
  const branches = await getPublicBranches();
  const initialReviews = await getPublicReviews(12);

  const productItems: ProductShowcaseItem[] = buildProductGroups(catalogItems);
  const variantItems: VariantShowcaseItem[] = buildVariantItems(catalogItems);
  const reviewVariantOptions = buildReviewVariantOptions(catalogItems);

  return (
    <main className="bg-dark text-white">
      <Navbar />
      <Hero />
      <Marquee />
      <hr className="hr-line" />
      <Products items={productItems} />
      <hr className="hr-line" />
      <WhySection />
      <hr className="hr-line" />
      <Variants items={variantItems} />
      <hr className="hr-line" />
      <Lifestyle />
      <hr className="hr-line" />
      <Testimonials initialReviews={initialReviews} variantOptions={reviewVariantOptions} />
      <hr className="hr-line" />
      <BranchesSection branches={branches} />
      <CtaSection />
      <Footer />
    </main>
  );
}
