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
  primary: "border-brand-yellow bg-brand-yellow text-black hover:bg-[#ffcf2a]",
  secondary: "border-brand-line bg-transparent text-brand-ink hover:border-brand-yellow hover:text-brand-yellow",
  ink: "border-brand-line bg-brand-surface text-brand-ink hover:border-brand-yellow",
};

const baseStyles =
  "corner-cut inline-flex h-11 items-center justify-center border px-5 font-body text-sm font-semibold uppercase tracking-[0.08em] transition-all duration-200 ease-pop hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:cursor-not-allowed disabled:opacity-60";

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
