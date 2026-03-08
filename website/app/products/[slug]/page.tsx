import { Metadata } from "next";
import { notFound } from "next/navigation";
import BadgeTag from "@/components/BadgeTag";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import StickerButton from "@/components/StickerButton";
import { getPublicCatalogProductBySlug, getPublicCatalogProducts } from "@/lib/publicCatalog";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicCatalogProductBySlug(slug);
  if (!product) {
    return {
      title: "Product Not Found | MDVPRS",
    };
  }
  return {
    title: `${product.name} | MDVPRS`,
    description: product.notes,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const [product, allProducts] = await Promise.all([
    getPublicCatalogProductBySlug(slug),
    getPublicCatalogProducts(),
  ]);

  if (!product) {
    notFound();
  }

  const relatedProducts = allProducts
    .filter((item) => item.slug !== product.slug && item.category === product.category)
    .slice(0, 3);

  return (
    <div className="page-wrap space-y-10">
      <SectionHeader title={product.name} subtitleJa={product.jpName} description="Specs, compatibility, and support details." />

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
        <div className="visual-placeholder hero-shimmer corner-cut relative min-h-[250px] overflow-hidden p-4 sm:min-h-[420px] sm:p-5">
          <div className="grid-overlay absolute inset-0 opacity-25" aria-hidden="true" />
          <div className="relative z-[1] flex h-full flex-col justify-between">
            <p className="jp-label">product visual placeholder</p>
            <p className="font-heading text-5xl uppercase leading-[0.88] text-brand-ink sm:text-7xl">{product.name}</p>
          </div>
        </div>

        <aside className="sticker-card grunge-paper corner-cut p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <BadgeTag key={`${product.slug}-${tag}`} tag={tag} />
            ))}
          </div>

          <h2 className="font-heading text-5xl uppercase leading-[0.86] text-brand-ink sm:text-6xl">{product.name}</h2>
          <p className="mt-1 text-sm uppercase tracking-[0.08em] text-brand-muted sm:text-base">
            {product.deviceType} {"\u2022"} {product.strength}
          </p>
          <p className="mt-3 text-sm text-brand-muted sm:text-base">{product.notes}</p>

          <dl className="mt-5 space-y-2 border-t border-brand-line pt-4">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex items-center justify-between gap-3">
                <dt className="text-sm uppercase tracking-[0.1em] text-brand-muted">{spec.label}</dt>
                <dd className="font-display text-[24px] uppercase text-brand-ink sm:text-[30px]">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <StickerButton href="/#products" className="w-full sm:w-auto">
              Catalog
            </StickerButton>
            <StickerButton href="/#testimonials" variant="secondary" className="w-full sm:w-auto">
              Reviews
            </StickerButton>
          </div>
          <p className="mt-3 font-display text-[28px] uppercase text-brand-yellow sm:text-[32px]">From PHP {product.priceFrom}</p>
          <p
            className={[
              "mt-2 inline-flex corner-cut border px-3 py-1 text-xs uppercase tracking-[0.14em]",
              (product.stockOnHand ?? 0) <= 0
                ? "border-red-400/50 bg-red-400/10 text-red-300"
                : (product.stockOnHand ?? 0) <= 10
                  ? "border-brand-yellow/60 bg-brand-yellow/10 text-brand-yellow"
                  : "border-brand-blue/60 bg-brand-blue/10 text-brand-blue",
            ].join(" ")}
          >
            {(product.stockOnHand ?? 0) <= 0
              ? "Out of stock"
              : `Stock ${Number.isInteger(product.stockOnHand ?? 0) ? product.stockOnHand : (product.stockOnHand ?? 0).toFixed(2)}`}
          </p>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <article className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
          <h3 className="font-heading text-4xl uppercase text-brand-ink sm:text-5xl">Flavor Notes</h3>
          <ul className="stagger-children mt-3 flex flex-wrap gap-2">
            {product.flavorNotes.map((note) => (
              <li key={note} className="border border-brand-line bg-brand-surface px-3 py-1 text-sm uppercase tracking-[0.08em] text-brand-ink">
                {note}
              </li>
            ))}
          </ul>
        </article>

        <article className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
          <h3 className="font-heading text-4xl uppercase text-brand-ink sm:text-5xl">In The Box</h3>
          <ul className="stagger-children mt-3 space-y-2">
            {product.inBox.map((item) => (
              <li key={item} className="border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-muted sm:text-base">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
        <h3 className="font-heading text-4xl uppercase text-brand-ink sm:text-5xl">FAQ</h3>
        <div className="stagger-children mt-4 space-y-3">
          {product.faq.map((entry) => (
            <details key={entry.question} className="border border-brand-line bg-brand-surface px-4 py-3">
              <summary className="cursor-pointer text-base uppercase tracking-[0.06em] text-brand-ink">{entry.question}</summary>
              <p className="mt-2 text-sm text-brand-muted sm:text-base">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="space-y-5">
          <SectionHeader title="Related Drops" subtitleJa="same category" description="Other picks from this line." />
          <div className="stagger-children grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="compliance-note">
        Adult-use product information only. Availability, packaging, and compliance notes may vary by location.
      </p>
    </div>
  );
}
