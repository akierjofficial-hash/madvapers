import { cn } from "@/lib/cn";

type ButtonSize = "sm" | "md" | "lg";
type ButtonVariant = "primary" | "secondary";

export interface ButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-6 py-2 text-xs",
  md: "px-10 py-4 text-sm",
  lg: "px-14 py-5 text-sm",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "btn-shimmer bg-brand-blue text-black shadow-[0_0_0_rgba(0,153,255,0)] hover:bg-[#33aaff] hover:shadow-[0_0_32px_rgba(0,153,255,0.5)]",
  secondary: "border border-white/20 bg-transparent text-white hover:border-brand-yellow hover:text-brand-yellow",
};

export default function Button({
  variant,
  size = "md",
  children,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "btn-clip relative inline-flex items-center justify-center font-heading font-bold uppercase tracking-[0.18em] transition-all duration-300",
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

