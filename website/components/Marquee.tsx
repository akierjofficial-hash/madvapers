const marqueeItems = [
  "Premium Vape",
  "MDVPRS",
  "??????",
  "Crafted for Connoisseurs",
  "Street Luxury",
  "10,000 Puffs",
  "Flavor Forward",
];

export default function Marquee() {
  const row = [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems];

  return (
    <section className="overflow-hidden border-y border-brand-blue/40 bg-brand-blue py-3">
      <div className="flex w-max gap-12 whitespace-nowrap [animation:marquee_30s_linear_infinite]">
        {row.map((item, index) => (
          <span key={`${item}-${index}`} className="flex flex-shrink-0 items-center gap-5 font-display text-sm uppercase tracking-[0.32em] text-black">
            {item}
            <span className="h-1.5 w-1.5 rounded-full bg-black/60" />
          </span>
        ))}
      </div>
    </section>
  );
}

