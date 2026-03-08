import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type StickerButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ink";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles: Record<NonNullable<StickerButtonProps["variant"]>, string> = {
  primary:
    "border-brand-yellow bg-brand-yellow text-black shadow-[0_14px_30px_-18px_rgba(255,195,0,0.82)] hover:bg-[#ffcf2a] hover:shadow-[0_18px_36px_-18px_rgba(255,195,0,0.9)]",
  secondary:
    "border-brand-line/90 bg-brand-surface/60 text-brand-ink backdrop-blur-sm hover:border-brand-yellow hover:bg-brand-surface2/80 hover:text-brand-yellow",
  ink: "border-brand-line/90 bg-brand-surface/75 text-brand-ink backdrop-blur-sm hover:border-brand-yellow",
};

const baseStyles =
  "corner-cut inline-flex h-[46px] items-center justify-center border px-4 font-body text-sm font-semibold uppercase tracking-[0.08em] transition-all duration-200 ease-pop hover:-translate-y-0.5 sm:h-11 sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:cursor-not-allowed disabled:opacity-60";

export default function StickerButton({
  children,
  href,
  variant = "primary",
  className,
  ...buttonProps
}: StickerButtonProps) {
  const classNames = cn(baseStyles, variantStyles[variant], className);

  if (href) {
    return (
      <Link href={href} className={classNames}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classNames} {...buttonProps}>
      {children}
    </button>
  );
}
