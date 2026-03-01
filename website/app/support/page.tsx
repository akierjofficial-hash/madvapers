import SectionHeader from "@/components/SectionHeader";
import StickerButton from "@/components/StickerButton";

const faqs = [
  {
    question: "How can I verify authenticity?",
    answer: "Buy only from authorized retailers and check official packaging identifiers when available.",
  },
  {
    question: "Where can I check stock near me?",
    answer: "Use the Branches page, then contact your branch for live stock details.",
  },
  {
    question: "Do you provide health or cessation guidance?",
    answer: "No. This site does not provide medical advice or smoking-cessation claims.",
  },
  {
    question: "Who can access these products?",
    answer: "Only adults of legal smoking age in their local region.",
  },
  {
    question: "Can I ask about wholesale?",
    answer: "Yes. Support can route wholesale and trade requests to the right team.",
  },
];

export default function SupportPage() {
  return (
    <div className="page-wrap space-y-8">
      <SectionHeader title="Support" subtitleJa="help center" description="Answers for product details, branch lookup, and customer support." />

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:gap-6">
        <div className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
          <h2 className="font-heading text-4xl uppercase text-brand-ink sm:text-5xl">FAQ</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="border border-brand-line bg-brand-surface px-4 py-3">
                <summary className="cursor-pointer text-base uppercase tracking-[0.06em] text-brand-ink">{faq.question}</summary>
                <p className="mt-2 text-sm text-brand-muted sm:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <aside className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
          <p className="jp-label">direct contact</p>
          <h2 className="mt-1 font-heading text-5xl uppercase leading-[0.86] text-brand-ink sm:text-6xl">Need Help Fast?</h2>
          <p className="mt-3 text-sm text-brand-muted sm:text-base">
            Reach our support desk for branch guidance, product references, and ordering concerns.
          </p>
          <div className="mt-4 space-y-1 border border-brand-line bg-brand-surface p-4 text-sm text-brand-muted sm:text-base">
            <p>
              <strong>Email:</strong> support@mdvprs.example
            </p>
            <p>
              <strong>Phone:</strong> +63 900 555 0101
            </p>
            <p>
              <strong>Hours:</strong> Mon-Sat, 10:00 AM - 8:00 PM
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <StickerButton href="/store-locator">Find Store</StickerButton>
            <StickerButton href="/products" variant="secondary">
              Browse Products
            </StickerButton>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.12em] text-brand-muted sm:text-sm">
            Adult-use information only. Keep out of reach of children and pets.
          </p>
        </aside>
      </section>
    </div>
  );
}
