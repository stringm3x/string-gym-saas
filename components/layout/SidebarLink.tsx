import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  /**
   * Indicador numérico ambiental — ej. miembros que vencen hoy,
   * alertas de stock bajo. null/0 no se muestra.
   */
  badge?: number | null;
  /**
   * Color del badge cuando requiere atención (rojo/amarillo).
   * Default: verde de marca.
   */
  badgeVariant?: "default" | "warning" | "danger";
}

const badgeStyles: Record<
  NonNullable<SidebarLinkProps["badgeVariant"]>,
  string
> = {
  default: "bg-brand-green text-bg",
  warning: "bg-warning text-bg",
  danger: "bg-danger text-text-primary",
};

export function SidebarLink({
  href,
  label,
  icon,
  active = false,
  badge,
  badgeVariant = "default",
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-surface text-text-primary"
          : "text-text-secondary hover:bg-surface hover:text-text-primary"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "transition-colors duration-150",
            active
              ? "text-brand-green"
              : "text-text-muted group-hover:text-text-secondary"
          )}
        >
          {icon}
        </span>
        {label}
      </span>

      {!!badge && badge > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold tabular-nums",
            badgeStyles[badgeVariant]
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
