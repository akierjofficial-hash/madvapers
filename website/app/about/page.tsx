import SectionHeader from "@/components/SectionHeader";

const values = [
  {
    title: "Street DNA",
    text: "Industrial visual language with sharp hierarchy and fast readability.",
  },
  {
    title: "Clear Specs",
    text: "Every item highlights format, nicotine strength, and key details before checkout.",
  },
  {
    title: "Responsible Messaging",
    text: "Public content is written for adults of legal smoking age only.",
  },
  {
    title: "Retail Focus",
    text: "Designed for quick browsing in real-world store and mobile scenarios.",
  },
];

export default function AboutPage() {
  return (
    <div className="page-wrap space-y-8">
      <SectionHeader
        title="About MDVPRS"
        subtitleJa="brand story"
        description="A minimalist urban street-poster identity built for fast adult retail communication."
      />

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="sticker-panel grunge-paper corner-cut p-6">
          <p className="jp-label">identity</p>
          <h2 className="mt-1 font-heading text-6xl uppercase leading-[0.84] text-brand-ink">Built For The Grind</h2>
          <p className="mt-3 text-base text-brand-muted">
            MDVPRS blends gritty poster energy with modern UX discipline. The website is focused on product clarity, speed, and branch-ready utility.
          </p>
          <p className="mt-2 text-base text-brand-muted">
            We keep content direct and structured, so adult customers can move from discovery to decision quickly.
          </p>
        </article>

        <div className="visual-placeholder corner-cut relative min-h-[280px] overflow-hidden p-5">
          <div className="grid-overlay absolute inset-0 opacity-30" aria-hidden="true" />
          <div className="relative z-[1] flex h-full flex-col justify-between">
            <p className="jp-label">brand visual placeholder</p>
            <p className="font-heading text-6xl uppercase leading-[0.86] text-brand-ink">Urban Poster Block</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {values.map((value) => (
          <article key={value.title} className="sticker-card corner-cut p-4">
            <h3 className="font-heading text-4xl uppercase text-brand-ink">{value.title}</h3>
            <p className="mt-1 text-base text-brand-muted">{value.text}</p>
          </article>
        ))}
      </section>

      <section className="compliance-note">
        This website is for adult-use product information only. Product labeling and legal requirements vary by jurisdiction.
      </section>
    </div>
  );
}
