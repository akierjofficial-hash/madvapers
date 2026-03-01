import SectionHeader from "@/components/SectionHeader";
import StickerButton from "@/components/StickerButton";
import { getPublicBranches } from "@/lib/publicBranches";

export default async function StoreLocatorPage() {
  const branches = await getPublicBranches();

  return (
    <div className="page-wrap space-y-8">
      <SectionHeader
        title="Branches"
        subtitleJa="authorized branches"
        description="Find official branches and contact each location directly."
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
        <div className="sticker-panel grunge-paper corner-cut p-4 sm:p-5">
          <h2 className="display-h2 text-brand-ink">Branches</h2>
          {branches.length === 0 ? (
            <p className="mt-3 font-body text-base text-brand-muted">No active branches available right now.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {branches.map((branch, idx) => (
                <li
                  key={branch.id}
                  id={`branch-${branch.id}`}
                  className="corner-cut border border-brand-line bg-brand-surface p-4 scroll-mt-24"
                >
                  <p className="font-body text-lg font-semibold text-brand-ink">{branch.name}</p>
                  <p className="mt-1 font-body text-sm uppercase tracking-[0.08em] text-brand-muted">{branch.code}</p>
                  <p className="mt-2 font-body text-base text-brand-muted">{branch.address || "-"}</p>
                  <p className="mt-2 font-body text-base text-brand-muted">
                    <strong>Locator:</strong> {branch.locator || "-"}
                  </p>
                  <p className="font-body text-base text-brand-muted">
                    <strong>Cellphone:</strong> {branch.cellphone_no || "-"}
                  </p>
                  {idx < branches.length - 1 ? <div className="mt-3 border-t border-brand-line/80" aria-hidden="true" /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="visual-placeholder corner-cut relative min-h-[280px] overflow-hidden p-4 sm:min-h-[420px] sm:p-5">
          <div className="grid-overlay absolute inset-0 opacity-25" aria-hidden="true" />
          <div className="relative z-[1] flex h-full flex-col justify-between">
            <p className="jp-label">map placeholder</p>
            <div>
              <p className="display-h2 text-brand-ink">Map Embed Slot</p>
              <p className="mt-1 font-body text-sm uppercase tracking-[0.08em] text-brand-yellow">connect maps widget later</p>
            </div>
          </div>
        </div>
      </section>

      <div>
        <StickerButton href="/support" variant="secondary">
          Need Branch Help
        </StickerButton>
      </div>
    </div>
  );
}
