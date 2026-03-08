"use client";

import useScrollReveal from "@/hooks/useScrollReveal";
import { cn } from "@/lib/cn";
import { useRef } from "react";

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

const features: FeatureItem[] = [
  {
    icon: "?",
    title: "Dual-Mesh Technology",
    desc: "Advanced coil engineering delivers unprecedented vapor density with pure, clean flavor on every draw.",
  },
  {
    icon: "??",
    title: "Precision Airflow",
    desc: "Adjustable airflow system engineered for the perfect draw resistance — tight or open, your choice.",
  },
  {
    icon: "??",
    title: "Fast Charge, Long Haul",
    desc: "650mAh battery with USB-C charging. Full power in 45 minutes. Built to keep up with your life.",
  },
  {
    icon: "?",
    title: "Premium Grade Liquid",
    desc: "USP pharmaceutical-grade ingredients. No compromise on what goes into your body. Ever.",
  },
];

function FeatureRow({ feature, delayClass }: { feature: FeatureItem; delayClass?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <div
      ref={ref}
      className={cn(
        "reveal flex cursor-default items-start gap-6 border-b border-white/10 py-7",
        isVisible && "visible",
        delayClass,
      )}
    >
      <div className="btn-clip flex h-12 w-12 flex-shrink-0 items-center justify-center border border-brand-blue/25 text-xl transition-all duration-300 group-hover:border-brand-blue">
        {feature.icon}
      </div>
      <div>
        <h3 className="font-heading text-2xl font-bold tracking-[0.06em]">{feature.title}</h3>
        <p className="mt-1 text-sm leading-7 text-[#8890A4]">{feature.desc}</p>
      </div>
    </div>
  );
}

export default function WhySection() {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const leftVisible = useScrollReveal(leftRef);
  const rightVisible = useScrollReveal(rightRef);

  return (
    <section id="why" className="bg-dark px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <div ref={leftRef} className={cn("reveal-left", leftVisible && "visible")}>
          <p className="mb-3 flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue before:block before:h-px before:w-6 before:bg-brand-blue">
            Why MDVPRS
          </p>
          <h2 className="font-display text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[0.04em]">
            BUILT
            <br />
            DIFFER<span className="text-brand-blue">ENT</span>
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#8890A4]">
            We don't make vapes. We craft experiences. Every detail is obsessed over so your ritual is flawless.
          </p>

          <div className="mt-8">
            {features.map((feature, index) => (
              <FeatureRow key={feature.title} feature={feature} delayClass={`delay-${Math.min(index + 2, 6)}`} />
            ))}
          </div>
        </div>

        <div ref={rightRef} className={cn("reveal-right relative", rightVisible && "visible")}>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,153,255,0.08)_0%,transparent_70%)]" />
          <article className="relative z-10 border border-brand-blue/15 bg-dark2 p-10">
            <p className="font-display text-[80px] leading-none tracking-[0.04em] text-brand-blue [text-shadow:0_0_40px_rgba(0,153,255,0.3)]">50+</p>
            <p className="mb-6 font-heading text-[13px] uppercase tracking-[0.3em] text-[#8890A4]">Premium Flavor Profiles</p>
            <blockquote className="border-l-2 border-brand-yellow pl-4 text-sm italic leading-7 text-[#B8BFCE]">
              "Every flavor is a statement. Crafted by flavor scientists obsessed with the perfect taste experience."
            </blockquote>

            <div className="mt-8 flex gap-8 border-t border-white/10 pt-6">
              <div>
                <p className="font-display text-4xl leading-none text-brand-yellow">99%</p>
                <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Satisfaction</p>
              </div>
              <div>
                <p className="font-display text-4xl leading-none text-brand-blue">10K</p>
                <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Puff Count</p>
              </div>
              <div>
                <p className="font-display text-4xl leading-none text-white">4+</p>
                <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Years Trusted</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

