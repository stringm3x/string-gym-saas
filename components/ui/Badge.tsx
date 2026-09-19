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

// Chip de estado: esquina viva, mono en mayúsculas (como los kickers del
// sitio: "PLAN", "ANTES / HOY"). Nada de píldoras.
const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-brand-green/10 text-brand-green border-brand-green/40",
  warning: "bg-warning/10 text-warning border-warning/40",
  danger: "bg-danger/10 text-danger border-danger/40",
  neutral: "bg-transparent text-text-secondary border-border",
  info: "bg-transparent text-text-secondary border-border",
  // Herencia: el sistema de marca retira el dorado. Pendiente de sustituir
  // en los badges de promoción/VIP que lo usan.
  gold: "bg-gold/10 text-gold border-gold/40",
};

export function Badge({
  variant = "neutral",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em]",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
