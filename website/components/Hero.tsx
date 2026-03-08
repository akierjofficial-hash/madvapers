"use client";

import Button from "@/components/ui/Button";
import Image from "next/image";
import { useEffect, useRef } from "react";

export default function Hero() {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = (): void => {
      const scrolled = window.scrollY;

      if (leftRef.current) {
        leftRef.current.style.transform = `translate3d(0, ${scrolled * 0.15}px, 0)`;
      }

      if (rightRef.current) {
        rightRef.current.style.transform = `translate3d(0, ${scrolled * 0.08}px, 0)`;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section id="hero" className="relative flex min-h-screen items-center overflow-hidden bg-dark pt-20">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 68% 46%, rgba(0,153,255,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 32% 80%, rgba(255,213,0,0.04) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,153,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,153,255,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand-blue to-transparent opacity-40"
        style={{ animation: "scanLine 6s linear infinite" }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-5 pb-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-14">
        <div ref={leftRef} className="will-change-transform">
          <div className="pt-8 lg:pt-14">
            <div className="mb-8 inline-flex translate-y-5 items-center gap-2 border border-brand-blue/30 bg-brand-blue/10 px-5 py-2 opacity-0 [animation:fadeUp_0.8s_ease_0.2s_forwards] btn-clip">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" style={{ animation: "pulse 2s ease-in-out infinite" }} />
              <span className="font-heading text-[11px] uppercase tracking-[0.3em] text-brand-blue">Premium Vape</span>
            </div>

            <h1 className="mb-2 translate-y-7 font-display text-[clamp(72px,8vw,120px)] leading-[0.9] tracking-[0.04em] opacity-0 [animation:fadeUp_0.9s_ease_0.4s_forwards]">
              <span className="text-brand-blue">MD</span>
              <span className="text-brand-yellow [text-shadow:0_0_40px_rgba(255,213,0,0.35)]">VPRS</span>
            </h1>

            <p className="mb-7 translate-y-7 font-display text-[clamp(28px,3vw,48px)] tracking-[0.3em] text-[#8890A4] opacity-0 [animation:fadeUp_0.9s_ease_0.55s_forwards]">
              {"\u30de\u30c3\u30c9\u3079\u30fc\u3077"}
            </p>

            <p className="mb-10 max-w-xl translate-y-5 text-[15px] leading-8 text-[#8890A4] opacity-0 [animation:fadeUp_0.9s_ease_0.7s_forwards]">
              Born from the streets. Refined for the elite. Premium vapor experiences engineered for those who demand more from every draw.
            </p>

            <div className="flex translate-y-5 flex-wrap gap-4 opacity-0 [animation:fadeUp_0.9s_ease_0.85s_forwards]">
              <a href="#variants">
                <Button variant="primary" size="md">
                  View Prices & Stock
                </Button>
              </a>
              <a href="#products">
                <Button variant="secondary" size="md">
                  Explore Collection
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div ref={rightRef} className="relative flex h-[360px] items-center justify-center opacity-0 will-change-transform [animation:fadeUp_1.2s_ease_0.5s_forwards] sm:h-[500px] lg:h-[620px]">
          <div className="pointer-events-none absolute h-[500px] w-[500px] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(0,153,255,0.15) 0%, transparent 70%)", animation: "breathe 4s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute bottom-16 right-10 h-[280px] w-[280px] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(255,213,0,0.08) 0%, transparent 70%)", animation: "breathe 5s ease-in-out infinite reverse" }} />

          <div className="pointer-events-none absolute h-[420px] w-[420px] rounded-full border border-brand-blue/10 [animation:orbit_20s_linear_infinite]">
            <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-brand-blue shadow-[0_0_12px_#0099FF]" />
            <span className="absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-yellow shadow-[0_0_12px_#FFD500]" />
          </div>

          <div className="pointer-events-none absolute h-[520px] w-[520px] rounded-full border border-dashed border-brand-blue/10 [animation:orbit_30s_linear_infinite_reverse]">
            <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-brand-blue shadow-[0_0_12px_#0099FF]" />
          </div>

          <div className="relative z-10 [animation:float_6s_ease-in-out_infinite]">
            <Image
              src="/logo.png"
              alt="MDVPRS"
              width={320}
              height={320}
              className="h-[220px] w-[220px] object-contain drop-shadow-[0_0_40px_rgba(0,153,255,0.4)] sm:h-[300px] sm:w-[300px]"
              priority
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-16 left-6 hidden gap-10 opacity-0 [animation:fadeUp_0.9s_ease_1.1s_forwards] sm:flex lg:left-14" aria-hidden="true">
        <div>
          <p className="font-display text-4xl leading-none">50<span className="text-brand-blue">+</span></p>
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Variants</p>
        </div>
        <div>
          <p className="font-display text-4xl leading-none">10<span className="text-brand-blue">K</span></p>
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Puff Count</p>
        </div>
        <div>
          <p className="font-display text-4xl leading-none">99<span className="text-brand-blue">%</span></p>
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-[#8890A4]">Satisfaction</p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-10 right-8 hidden flex-col items-center gap-2 opacity-0 [animation:fadeUp_1s_ease_1.4s_forwards] sm:flex lg:right-14" aria-hidden="true">
        <div className="h-[62px] w-px bg-gradient-to-b from-brand-blue to-transparent [animation:pulse_2s_ease-in-out_infinite]" />
        <p className="font-heading text-[9px] uppercase tracking-[0.3em] text-[#8890A4] [writing-mode:vertical-lr]">SCROLL</p>
      </div>
    </section>
  );
}

