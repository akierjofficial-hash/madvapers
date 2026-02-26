import ProductsCatalogClient from "@/components/ProductsCatalogClient";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";

export default async function ProductsPage() {
  const products = await getPublicCatalogProducts();
  return <ProductsCatalogClient products={products} />;
}

