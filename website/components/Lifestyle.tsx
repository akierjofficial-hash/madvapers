"use client";

import useScrollReveal from "@/hooks/useScrollReveal";
import { cn } from "@/lib/cn";
import { useRef } from "react";

interface LifestyleCardProps {
  num: string;
  title: string;
  desc: string;
  delayClass?: string;
}

function LifestyleCard({ num, title, desc, delayClass }: LifestyleCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <article
      ref={ref}
      className={cn(
        "ls-card reveal group relative overflow-hidden border border-white/10 bg-dark2 p-8 transition-all duration-300 hover:translate-x-1 hover:border-brand-blue/30",
        isVisible && "visible",
        delayClass,
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] origin-bottom scale-y-0 bg-brand-blue transition-transform duration-300 group-hover:scale-y-100" />
      <p className="font-display text-6xl leading-none text-brand-blue/20">{num}</p>
      <h3 className="mt-2 font-heading text-2xl font-bold tracking-[0.06em]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#8890A4]">{desc}</p>
    </article>
  );
}

const cards: LifestyleCardProps[] = [
  {
    num: "01",
    title: "The Modern Ritual",
    desc: "Every draw is intentional. MDVPRS devices are designed to fit seamlessly into moments that matter.",
    delayClass: "delay-1",
  },
  {
    num: "02",
    title: "Street-Luxury Aesthetic",
    desc: "Japanese street culture meets premium product design. Bold enough for the city. Refined enough for anywhere.",
    delayClass: "delay-2",
  },
  {
    num: "03",
    title: "Flavor as Identity",
    desc: "What you vape says something about you. Our 50+ flavors aren't choices — they're expressions.",
    delayClass: "delay-3",
  },
];

const tags = [
  "Premium Quality",
  "Street Culture",
  "Flavor Forward",
  "Tokyo Inspired",
  "Night Life",
  "Ultra Premium",
  "??????",
  "Collectors Edition",
  "Performance",
];

export default function Lifestyle() {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const tagsRef = useRef<HTMLDivElement | null>(null);

  const leftVisible = useScrollReveal(leftRef);
  const rightVisible = useScrollReveal(rightRef);
  const tagsVisible = useScrollReveal(tagsRef);

  return (
    <section id="lifestyle" className="flex min-h-screen items-center bg-dark px-5 py-24 sm:px-8 lg:px-14">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-28">
          <div ref={leftRef} className={cn("reveal-left", leftVisible && "visible")}>
            <p className="mb-3 flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue before:block before:h-px before:w-6 before:bg-brand-blue">
              The Culture
            </p>
            <h2 className="font-display text-[clamp(56px,6vw,88px)] leading-[0.9] tracking-[0.04em]">
              CRAFTED
              <br />
              FOR THE
              <br />
              <span className="text-brand-blue">RITUAL</span>
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#8890A4]">
              MDVPRS isn't just a vape. It's a statement. A way of moving through the world with intention, style, and edge.
            </p>

            <p className="mt-10 border-t border-white/10 pt-10 font-display text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[0.2em] text-white/10">
              Modern
              <br />
              <span className="text-brand-yellow/90">Luxury</span>
              <br />
              Defined
            </p>
          </div>

          <div ref={rightRef} className={cn("reveal-right flex flex-col gap-4", rightVisible && "visible")}>
            {cards.map((card) => (
              <LifestyleCard key={card.num} {...card} />
            ))}
          </div>
        </div>

        <div ref={tagsRef} className={cn("reveal mt-14 flex flex-wrap gap-3", tagsVisible && "visible")}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="btn-clip cursor-pointer border border-white/10 px-6 py-2.5 font-heading text-xs uppercase tracking-[0.2em] text-[#B8BFCE] transition-all duration-300 hover:border-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

