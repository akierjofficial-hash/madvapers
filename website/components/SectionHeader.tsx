import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  title: string;
  subtitleJa: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export default function SectionHeader({
  title,
  subtitleJa,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn("relative space-y-2.5", align === "center" && "text-center", className)}>
      <p className="jp-label uppercase tracking-[0.09em]">{subtitleJa}</p>
      <h2 className="display-h2 text-balance text-brand-ink">{title}</h2>
      <div
        className={cn(
          "relative h-[2px] w-28 overflow-hidden bg-brand-yellow/80",
          align === "center" && "mx-auto",
        )}
        aria-hidden="true"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>
      {description ? <p className="max-w-3xl font-body text-sm text-brand-muted sm:text-base">{description}</p> : null}
    </header>
  );
}
