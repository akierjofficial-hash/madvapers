const reviews = [
  {
    name: "Kenji R.",
    quote: "Fast checkout and very clear product details.",
  },
  {
    name: "Rica P.",
    quote: "The store lookup helped me find stock quickly.",
  },
  {
    name: "Miko T.",
    quote: "Looks sharp on mobile and desktop.",
  },
  {
    name: "Dale C.",
    quote: "Simple browsing, no clutter, easy to compare options.",
  },
];

export default function ReviewsCarousel() {
  return (
    <section className="sticker-panel grunge-paper corner-cut p-5">
      <p className="jp-label">customer voice</p>
      <h3 className="mt-1 font-heading text-5xl uppercase text-brand-ink">Reviews</h3>
      <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {reviews.map((review) => (
          <article key={review.name} className="corner-cut min-w-[260px] snap-start border border-brand-line bg-brand-surface p-4 sm:min-w-[320px]">
            <p className="text-base text-brand-muted">"{review.quote}"</p>
            <p className="mt-3 font-heading text-[30px] uppercase text-brand-ink">{review.name}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
