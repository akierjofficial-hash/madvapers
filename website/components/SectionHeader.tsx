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
    <header className={cn("space-y-2.5", align === "center" && "text-center", className)}>
      <p className="jp-label">{subtitleJa}</p>
      <h2 className="display-h2 text-brand-ink">{title}</h2>
      <div className={cn("h-[2px] w-24 bg-brand-yellow/80", align === "center" && "mx-auto")} aria-hidden="true" />
      {description ? <p className="max-w-3xl font-body text-base text-brand-muted">{description}</p> : null}
    </header>
  );
}
