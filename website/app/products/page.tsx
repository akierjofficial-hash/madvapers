import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductsCatalogClient from "@/components/ProductsCatalogClient";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";

export default async function ProductsPage() {
  const products = await getPublicCatalogProducts();
  return (
    <main className="bg-dark text-white">
      <Navbar />
      <div className="pt-24">
        <ProductsCatalogClient products={products} />
      </div>
      <Footer />
    </main>
  );
}
