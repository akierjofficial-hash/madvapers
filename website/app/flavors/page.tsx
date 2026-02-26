import ProductsCatalogClient from "@/components/ProductsCatalogClient";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";

export default async function FlavorsPage() {
  const products = await getPublicCatalogProducts();
  return (
    <ProductsCatalogClient
      products={products}
      title="Flavors"
      subtitleJa="フレーバー"
      description="Explore flavor-focused picks with clear nicotine strength and device format."
    />
  );
}

