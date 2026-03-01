import Link from "next/link";
import BadgeTag from "@/components/BadgeTag";
import StickerButton from "@/components/StickerButton";
import { Product } from "@/lib/products";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const primaryTag = product.tags[0] ?? "NEW";
  const flavorNote = product.flavorNotes[0] ?? product.notes;

  return (
    <article className="corner-cut sticker-card overflow-hidden p-3.5 transition-all duration-200 ease-pop hover:-translate-y-0.5 hover:border-brand-yellow hover:shadow-stickerHover sm:p-4">
      <div className="visual-placeholder corner-cut relative mb-4 aspect-[4/3] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <BadgeTag tag={primaryTag} />
          <span className="jp-label text-brand-muted">drop</span>
        </div>
      </div>

      <h3 className="font-body text-lg font-semibold text-brand-ink">{product.name}</h3>
      <p className="mt-1 font-body text-sm text-brand-muted">{flavorNote}</p>
      <p className="mt-2 font-body text-sm text-brand-muted">
        {product.deviceType} {"\u2022"} {product.strength}
      </p>

      <div className="mt-4 grid gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <p className="font-body text-base font-semibold text-brand-ink">PHP {product.priceFrom}</p>
        <StickerButton href={`/products/${product.slug}`} variant="primary" className="h-10 w-full px-4 sm:w-auto">
          Shop
        </StickerButton>
      </div>

      <Link href={`/products/${product.slug}`} className="sr-only">
        Open {product.name}
      </Link>
    </article>
  );
}
