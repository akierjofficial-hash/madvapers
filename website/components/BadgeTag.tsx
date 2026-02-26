import { ProductTag } from "@/lib/products";
import { cn } from "@/lib/cn";

type BadgeTagProps = {
  tag: ProductTag | string;
  className?: string;
};

const tagStyle: Record<string, string> = {
  NEW: "border-brand-yellow bg-brand-yellow/10 text-brand-yellow",
  ICE: "border-brand-line bg-brand-surface2 text-brand-ink",
  BEST: "border-brand-line bg-brand-surface2 text-brand-ink",
  LIMITED: "border-brand-line bg-brand-surface2 text-brand-ink",
};

export default function BadgeTag({ tag, className }: BadgeTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-body text-[11px] font-semibold uppercase tracking-[0.08em]",
        tagStyle[tag] ?? "border-brand-line bg-brand-surface text-brand-ink",
        className,
      )}
    >
      {tag}
    </span>
  );
}
