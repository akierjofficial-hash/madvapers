import type { PublicBranch } from "@/lib/publicBranches";

interface BranchesSectionProps {
  branches: PublicBranch[];
}

export default function BranchesSection({ branches }: BranchesSectionProps) {
  return (
    <section id="branches" className="bg-dark2 px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-14 text-center">
          <p className="mb-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue">Branches</p>
          <h2 className="font-display text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[0.04em]">
            STORE
            <br />
            <span className="text-brand-blue">LOCATOR</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[#8890A4]">
            Find official MadVapers branches and contact each location directly for stock confirmation.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <div className="border border-brand-blue/15 bg-dark p-5">
            <h3 className="font-heading text-lg uppercase tracking-[0.2em] text-white">Active Branches</h3>
            {branches.length === 0 ? (
              <p className="mt-4 text-sm text-[#B8BFCE]">No active branches available right now.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {branches.map((branch, idx) => (
                  <li key={branch.id} className="border border-white/10 bg-dark2 p-4">
                    <p className="font-heading text-base uppercase tracking-[0.08em] text-white">{branch.name}</p>
                    <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-blue">{branch.code}</p>
                    <p className="mt-2 text-sm leading-7 text-[#B8BFCE]">{branch.address || "-"}</p>
                    <p className="text-sm text-[#B8BFCE]">
                      <strong>Locator:</strong> {branch.locator || "-"}
                    </p>
                    <p className="text-sm text-[#B8BFCE]">
                      <strong>Cellphone:</strong> {branch.cellphone_no || "-"}
                    </p>
                    {idx < branches.length - 1 ? <div className="mt-3 border-t border-white/10" aria-hidden="true" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative min-h-[320px] overflow-hidden border border-brand-blue/15 bg-dark p-5 sm:min-h-[460px]">
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,153,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,153,255,0.08) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
              aria-hidden="true"
            />
            <div className="relative z-[1] flex h-full flex-col justify-between">
              <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-brand-blue">map placeholder</p>
              <div>
                <p className="font-display text-[clamp(36px,4vw,56px)] leading-[0.92] tracking-[0.04em] text-white">MAP EMBED SLOT</p>
                <p className="mt-2 font-heading text-xs uppercase tracking-[0.2em] text-brand-yellow">connect maps widget later</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

