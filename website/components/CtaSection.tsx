import Button from "@/components/ui/Button";

export default function CtaSection() {
  return (
    <section id="cta" className="relative overflow-hidden bg-dark px-5 py-24 text-center sm:px-8 lg:px-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(0,153,255,0.08)_0%,transparent_70%)]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,153,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,153,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-4xl">
        <p className="mb-8 font-heading text-xs uppercase tracking-[0.4em] text-brand-blue">The Next Level Awaits</p>
        <h2 className="font-display text-[clamp(60px,7vw,100px)] leading-[0.9] tracking-[0.04em]">
          YOUR
          <br />
          <span className="text-brand-yellow">RITUAL</span>
          <br />
          STARTS HERE
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-8 text-[#8890A4]">
          Join thousands of MDVPRS loyalists who refuse to settle for less.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
          <a href="#products">
            <Button variant="primary" size="lg">
              Browse Products
            </Button>
          </a>
          <a href="#variants">
            <Button variant="secondary" size="lg">
              Explore Variants
            </Button>
          </a>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:gap-8 sm:text-left">
          <p className="flex items-center gap-2 font-heading text-xs tracking-[0.08em] text-[#8890A4]">
            <span className="text-brand-blue">v</span> Free Shipping $40+
          </p>
          <p className="flex items-center gap-2 font-heading text-xs tracking-[0.08em] text-[#8890A4]">
            <span className="text-brand-blue">v</span> Age Verified Checkout
          </p>
          <p className="flex items-center gap-2 font-heading text-xs tracking-[0.08em] text-[#8890A4]">
            <span className="text-brand-blue">v</span> 30-Day Guarantee
          </p>
        </div>

        <p className="mt-12 font-display text-[clamp(28px,4vw,48px)] tracking-[0.4em] text-white/10">MDVPRS</p>
      </div>
    </section>
  );
}

