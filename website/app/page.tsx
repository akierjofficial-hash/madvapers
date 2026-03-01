import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import StickerButton from "@/components/StickerButton";
import { getPublicCatalogProducts } from "@/lib/publicCatalog";
import Image from "next/image";

const trustItems = [
  {
    label: "In-Store Visits",
    jp: "walk-in only",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 10h16v10H4z" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 15h.01" />
      </svg>
    ),
  },
  {
    label: "Authentic",
    jp: "genuine",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.2 2.8 7.5 7 9 4.2-1.5 7-4.8 7-9V6z" />
        <path d="m8.5 12 2.2 2.2L15.8 9" />
      </svg>
    ),
  },
  {
    label: "Support",
    jp: "support",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 12a8 8 0 1 1 16 0" />
        <path d="M4 12v5h3v-5H4zm13 0v5h3v-5h-3z" />
        <path d="M12 20h2" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const products = await getPublicCatalogProducts();
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="page-wrap space-y-10 sm:space-y-12">
      <section className="corner-cut grunge-smudge relative overflow-hidden border border-brand-line bg-brand-surface p-4 sm:p-8">
        <div className="pointer-events-none absolute -right-20 top-16 h-[2px] w-72 rotate-[-22deg] bg-brand-yellow/80" aria-hidden="true" />
        <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="order-2 space-y-4 lg:order-1 lg:space-y-5">
            <p className="jp-label text-brand-muted">Premium Vape</p>
            <h1 className="display-h1 text-brand-ink">
              Puff and
              <br />
              Chill
            </h1>
            <p className="max-w-xl font-body text-base text-brand-muted sm:text-lg">
              Clean flavor-forward lineup built for adult customers who want consistent quality and clear product specs.
            </p>
            <p className="jp-label text-brand-muted">urban minimal design</p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <StickerButton href="/products" className="w-full sm:w-auto">
                Shop Products
              </StickerButton>
              <StickerButton href="/store-locator" variant="secondary" className="w-full sm:w-auto">
                Find a Store
              </StickerButton>
            </div>
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="mobile-surface corner-cut relative min-h-[260px] p-3 sm:min-h-[430px] sm:p-5">
              <div className="absolute inset-3 overflow-hidden rounded-sm border border-brand-line bg-[#0f1114] sm:inset-5">
                <Image
                  src="/website.jpg"
                  alt="MDVPRS product visual"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover object-center"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="corner-cut border border-brand-line bg-brand-surface2 px-4 py-3">
        <ul className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {trustItems.map((item, idx) => (
            <li
              key={item.label}
              className="touch-row relative flex items-center justify-start gap-2 border border-brand-line/60 bg-brand-surface px-3 text-left font-body text-sm font-semibold uppercase tracking-[0.08em] text-brand-ink sm:justify-center sm:border-0 sm:bg-transparent sm:px-0 sm:text-center"
            >
              {idx < trustItems.length - 1 ? <span className="pointer-events-none absolute right-0 top-1/2 hidden h-6 w-px -translate-y-1/2 bg-brand-line sm:block" /> : null}
              <span className="text-brand-muted">{item.icon}</span>
              <span>{item.label}</span>
              <span className="jp-label text-brand-muted">{item.jp}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="featured-flavors" className="space-y-5">
        <SectionHeader title="Featured Flavors" subtitleJa="featured lineup" description="Top picks from the live product catalog." />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
