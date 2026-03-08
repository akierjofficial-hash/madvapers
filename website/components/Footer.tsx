import Image from "next/image";

const shopLinks = ["All Devices", "Disposable Vapes", "Flavor Bundles", "Limited Editions", "Accessories"];
const brandLinks = ["Our Story", "The Culture", "Flavor Lab", "MDVPRS Media", "Wholesale"];
const supportLinks = ["Age Verification", "Shipping Policy", "Returns", "Contact Us", "FAQ"];
const socialLinks = [
  { id: "x", label: "X" },
  { id: "yt", label: "YT" },
  { id: "ig", label: "IG" },
  { id: "tt", label: "TT" },
];

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-5 font-heading text-[13px] font-bold uppercase tracking-[0.3em] text-white">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="text-sm text-[#8890A4] transition-colors duration-300 hover:text-brand-blue">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-dark2 px-5 pb-10 pt-16 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-14">
          <div>
            <Image
              src="/logo.png"
              alt="MDVPRS"
              width={190}
              height={56}
              className="h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(0,153,255,0.4)]"
            />
            <p className="mt-4 max-w-xs text-sm leading-7 text-[#8890A4]">
              Born from the streets, refined for the connoisseur. MDVPRS is more than a vape brand - it's a movement.
            </p>
            <div className="mt-5 flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.id}
                  href="#"
                  className="btn-clip flex h-9 w-9 items-center justify-center border border-brand-blue/20 text-sm text-[#8890A4] transition-all duration-300 hover:border-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Shop" links={shopLinks} />
          <FooterColumn title="Brand" links={brandLinks} />
          <FooterColumn title="Support" links={supportLinks} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs tracking-[0.08em] text-[#8890A4]">© 2026 MDVPRS · All rights reserved · Must be 21+ to purchase</p>
          <p className="font-display text-2xl tracking-[0.3em] text-brand-blue/30">MDVPRS</p>
          <p className="text-xs font-heading tracking-[0.08em] text-brand-yellow/60">Nicotine is addictive</p>
        </div>
      </div>
    </footer>
  );
}

