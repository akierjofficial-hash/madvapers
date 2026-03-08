import { Product, ProductTag, products as fallbackProducts } from "@/lib/products";

type PublicCatalogVariant = {
  id: number;
  sku: string;
  qty_on_hand: number | string | null;
  variant_name: string | null;
  flavor: string | null;
  nicotine_strength: string | null;
  resistance: string | null;
  capacity: string | null;
  color: string | null;
  default_price: number | string | null;
  created_at: string | null;
  product: {
    id: number;
    name: string;
    description: string | null;
    product_type: string | null;
    base_price: number | string | null;
    brand: { id: number; name: string } | null;
    category: { id: number; name: string } | null;
  } | null;
};

type PublicCatalogListResponse = {
  data?: PublicCatalogVariant[];
};

type PublicCatalogItemResponse = {
  data?: PublicCatalogVariant;
};

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000/api";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseNumeric(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapFlavorCategory(type: string | null, flavor: string | null, name: string): Product["flavorCategory"] {
  const joined = `${type ?? ""} ${flavor ?? ""} ${name}`.toLowerCase();
  if (joined.includes("menthol") || joined.includes("ice") || joined.includes("mint")) {
    return "Menthol";
  }
  if (joined.includes("tobacco")) {
    return "Tobacco";
  }
  if (joined.includes("dessert") || joined.includes("cream") || joined.includes("donut") || joined.includes("vanilla")) {
    return "Dessert";
  }
  if (flavor && flavor.trim().length > 0) {
    return "Fruit";
  }
  return "Mix";
}

function mapCategory(type: string | null): Product["category"] {
  switch ((type ?? "").toUpperCase()) {
    case "DISPOSABLE":
      return "Disposable";
    case "POD_CARTRIDGE":
      return "Pod Cartridge";
    case "JUICE_FREEBASE":
    case "JUICE_SALT":
      return "E-Liquid";
    case "COIL_ACCESSORY":
      return "Accessories";
    case "DEVICE":
    default:
      return "Pod System";
  }
}

function mapDeviceType(type: string | null): Product["deviceType"] {
  switch ((type ?? "").toUpperCase()) {
    case "DISPOSABLE":
      return "Disposable";
    case "POD_CARTRIDGE":
      return "Pod Cartridge";
    case "JUICE_FREEBASE":
      return "Freebase";
    case "JUICE_SALT":
      return "Salt Nic";
    case "COIL_ACCESSORY":
      return "Accessory";
    case "DEVICE":
    default:
      return "Pod System";
  }
}

function mapHeroTone(type: string | null): Product["heroTone"] {
  switch ((type ?? "").toUpperCase()) {
    case "DISPOSABLE":
    case "POD_CARTRIDGE":
      return "yellow";
    case "COIL_ACCESSORY":
      return "ink";
    case "JUICE_FREEBASE":
    case "JUICE_SALT":
    case "DEVICE":
    default:
      return "blue";
  }
}

function mapTags(variant: PublicCatalogVariant): ProductTag[] {
  const tags: ProductTag[] = [];
  const flavorText = `${variant.flavor ?? ""} ${variant.variant_name ?? ""}`.toLowerCase();
  const createdAt = variant.created_at ? Date.parse(variant.created_at) : NaN;
  const price = parseNumeric(variant.default_price);

  if (flavorText.includes("ice") || flavorText.includes("mint") || flavorText.includes("menthol")) {
    tags.push("ICE");
  }

  if (Number.isFinite(createdAt)) {
    const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (ageDays <= 45) {
      tags.push("NEW");
    }
  }

  if (price !== null && price >= 700) {
    tags.push("LIMITED");
  } else if (price !== null && price > 0 && price <= 550) {
    tags.push("BEST");
  }

  return Array.from(new Set(tags)).slice(0, 2);
}

function parseStrength(value: string | null): string {
  if (!value || !value.trim()) {
    return "0mg";
  }
  return value.trim();
}

function buildFlavorNotes(variant: PublicCatalogVariant): string[] {
  if (!variant.flavor || !variant.flavor.trim()) {
    return ["N/A"];
  }
  const split = variant.flavor
    .split(/[,+/]/)
    .map((v) => v.trim())
    .filter(Boolean);
  return split.length > 0 ? split : [variant.flavor];
}

function buildInBox(deviceType: Product["deviceType"]): string[] {
  switch (deviceType) {
    case "Disposable":
      return ["1 Disposable Device"];
    case "Pod Cartridge":
      return ["1 Pod Cartridge Pack"];
    case "Salt Nic":
    case "Freebase":
      return ["1 E-liquid Bottle"];
    case "Accessory":
      return ["1 Accessory Pack"];
    case "Pod System":
    default:
      return ["1 Device", "User Guide"];
  }
}

function buildFaq(deviceType: Product["deviceType"]): Product["faq"] {
  switch (deviceType) {
    case "Disposable":
      return [
        { question: "Is this refillable?", answer: "No. Disposable units are single-use and replaced when depleted." },
        { question: "Can this be recharged?", answer: "Check product specifications for charging support before use." },
      ];
    case "Pod Cartridge":
      return [
        { question: "Is this device compatible?", answer: "Confirm compatibility against the SKU and model before purchase." },
        { question: "How many pods are included?", answer: "Pack quantity depends on the specific listing." },
      ];
    default:
      return [
        { question: "How do I verify authenticity?", answer: "Buy only from authorized branches and verify packaging details." },
        { question: "Is this for adults only?", answer: "Yes. Product information is intended for adults of legal smoking age." },
      ];
  }
}

function mapVariantToProduct(variant: PublicCatalogVariant): Product | null {
  if (!variant.product || !variant.product.name) {
    return null;
  }

  const productName = variant.product.name.trim();
  const variantLabel = variant.variant_name?.trim() || variant.flavor?.trim() || "";
  const name = variantLabel ? `${productName} - ${variantLabel}` : productName;
  const slugBase = slugify(name || `product-${variant.id}`);
  const slug = `${slugBase}-${variant.id}`;

  const deviceType = mapDeviceType(variant.product.product_type);
  const notes =
    variant.product.description?.trim() ||
    (variant.flavor?.trim() ? `Flavor profile: ${variant.flavor.trim()}` : "Product details available in-store.");

  const numericPrice = parseNumeric(variant.default_price) ?? parseNumeric(variant.product.base_price) ?? 0;
  const brand = variant.product.brand?.name?.trim();
  const categoryName = variant.product.category?.name?.trim();
  const flavorNotes = buildFlavorNotes(variant);

  const specs: Array<{ label: string; value: string }> = [
    { label: "SKU", value: variant.sku },
    { label: "Type", value: deviceType },
  ];

  if (variant.capacity) {
    specs.push({ label: "Capacity", value: variant.capacity });
  }
  if (variant.resistance) {
    specs.push({ label: "Resistance", value: variant.resistance });
  }
  if (variant.color) {
    specs.push({ label: "Color", value: variant.color });
  }
  if (variant.nicotine_strength) {
    specs.push({ label: "Nicotine", value: variant.nicotine_strength });
  }
  if (brand) {
    specs.push({ label: "Brand", value: brand });
  }

  return {
    id: variant.id,
    productId: variant.product.id,
    stockOnHand: parseNumeric(variant.qty_on_hand) ?? 0,
    name,
    productName,
    slug,
    jpName: `${(variant.product.product_type ?? "PRODUCT").replaceAll("_", " ")}`,
    category: mapCategory(variant.product.product_type),
    flavorCategory: mapFlavorCategory(variant.product.product_type, variant.flavor, name),
    deviceType,
    productType: variant.product.product_type,
    brandName: brand ?? null,
    categoryName: categoryName ?? null,
    variantName: variant.variant_name ?? null,
    flavor: variant.flavor ?? null,
    sku: variant.sku,
    strength: parseStrength(variant.nicotine_strength),
    notes,
    tags: mapTags(variant),
    priceFrom: numericPrice,
    heroTone: mapHeroTone(variant.product.product_type),
    specs,
    flavorNotes,
    inBox: buildInBox(deviceType),
    faq: buildFaq(deviceType),
  };
}

function parseIdFromSlug(slug: string): number | null {
  const trimmed = slug.trim();
  if (/^\d+$/.test(trimmed)) {
    const directId = Number(trimmed);
    return Number.isInteger(directId) && directId > 0 ? directId : null;
  }
  const parts = trimmed.split("-").filter(Boolean);
  const tail = parts.at(-1);
  if (!tail || !/^\d+$/.test(tail)) {
    return null;
  }
  const id = Number(tail);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function fetchCatalogListFromBackend(): Promise<Product[] | null> {
  try {
    const res = await fetch(`${BACKEND_API_BASE_URL}/public/products?per_page=500`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as PublicCatalogListResponse;
    const rawItems = payload.data ?? [];
    const mapped = rawItems
      .map(mapVariantToProduct)
      .filter((item): item is Product => item !== null);
    return mapped;
  } catch {
    return null;
  }
}

async function fetchCatalogItemFromBackend(id: number): Promise<Product | null> {
  try {
    const res = await fetch(`${BACKEND_API_BASE_URL}/public/products/${id}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as PublicCatalogItemResponse;
    if (!payload.data) {
      return null;
    }
    return mapVariantToProduct(payload.data);
  } catch {
    return null;
  }
}

export async function getPublicCatalogProducts(): Promise<Product[]> {
  const live = await fetchCatalogListFromBackend();
  if (live !== null) {
    return live;
  }
  return fallbackProducts;
}

export async function getPublicCatalogProductBySlug(slug: string): Promise<Product | null> {
  const id = parseIdFromSlug(slug);
  if (id !== null) {
    const live = await fetchCatalogItemFromBackend(id);
    if (live) {
      return live;
    }
  }
  return fallbackProducts.find((item) => item.slug === slug) ?? null;
}
