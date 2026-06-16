import { cn } from "@/lib/utils/cn";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info"
  | "gold";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-brand-green/15 text-brand-green border-brand-green/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  neutral: "bg-surface text-text-secondary border-border",
  info: "bg-gold/15 text-gold border-gold/30",
  gold: "bg-gold/15 text-gold border-gold/30",
};

export function Badge({
  variant = "neutral",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
