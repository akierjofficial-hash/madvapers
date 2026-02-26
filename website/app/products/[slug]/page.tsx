import { Metadata } from "next";
import { notFound } from "next/navigation";
import BadgeTag from "@/components/BadgeTag";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import StickerButton from "@/components/StickerButton";
import { getPublicCatalogProductBySlug, getPublicCatalogProducts } from "@/lib/publicCatalog";

type ProductDetailPageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const product = await getPublicCatalogProductBySlug(params.slug);
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
  const [product, allProducts] = await Promise.all([
    getPublicCatalogProductBySlug(params.slug),
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

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="visual-placeholder corner-cut relative min-h-[340px] overflow-hidden p-5 sm:min-h-[420px]">
          <div className="grid-overlay absolute inset-0 opacity-25" aria-hidden="true" />
          <div className="relative z-[1] flex h-full flex-col justify-between">
            <p className="jp-label">product visual placeholder</p>
            <p className="font-heading text-7xl uppercase leading-[0.88] text-brand-ink">{product.name}</p>
          </div>
        </div>

        <aside className="sticker-card grunge-paper corner-cut p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <BadgeTag key={`${product.slug}-${tag}`} tag={tag} />
            ))}
          </div>

          <h2 className="font-heading text-6xl uppercase leading-[0.86] text-brand-ink">{product.name}</h2>
          <p className="mt-1 text-base uppercase tracking-[0.08em] text-brand-muted">
            {product.deviceType} {"\u2022"} {product.strength}
          </p>
          <p className="mt-3 text-base text-brand-muted">{product.notes}</p>

          <dl className="mt-5 space-y-2 border-t border-brand-line pt-4">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex items-center justify-between gap-3">
                <dt className="text-sm uppercase tracking-[0.1em] text-brand-muted">{spec.label}</dt>
                <dd className="font-display text-[30px] uppercase text-brand-ink">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <StickerButton href="/products">Shop Now</StickerButton>
            <StickerButton href="/support" variant="secondary">
              Support
            </StickerButton>
          </div>
          <p className="mt-3 font-display text-[32px] uppercase text-brand-yellow">From PHP {product.priceFrom}</p>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="sticker-panel grunge-paper corner-cut p-5">
          <h3 className="font-heading text-5xl uppercase text-brand-ink">Flavor Notes</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {product.flavorNotes.map((note) => (
              <li key={note} className="border border-brand-line bg-brand-surface px-3 py-1 text-sm uppercase tracking-[0.08em] text-brand-ink">
                {note}
              </li>
            ))}
          </ul>
        </article>

        <article className="sticker-panel grunge-paper corner-cut p-5">
          <h3 className="font-heading text-5xl uppercase text-brand-ink">In The Box</h3>
          <ul className="mt-3 space-y-2">
            {product.inBox.map((item) => (
              <li key={item} className="border border-brand-line bg-brand-surface px-3 py-2 text-base text-brand-muted">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="sticker-panel grunge-paper corner-cut p-5">
        <h3 className="font-heading text-5xl uppercase text-brand-ink">FAQ</h3>
        <div className="mt-4 space-y-3">
          {product.faq.map((entry) => (
            <details key={entry.question} className="border border-brand-line bg-brand-surface px-4 py-3">
              <summary className="cursor-pointer text-base uppercase tracking-[0.06em] text-brand-ink">{entry.question}</summary>
              <p className="mt-2 text-base text-brand-muted">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="space-y-5">
          <SectionHeader title="Related Drops" subtitleJa="same category" description="Other picks from this line." />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
