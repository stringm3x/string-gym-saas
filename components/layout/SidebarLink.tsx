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
  /** Modo colapsado: solo ícono + tooltip. */
  collapsed?: boolean;
}

const badgeStyles: Record<
  NonNullable<SidebarLinkProps["badgeVariant"]>,
  string
> = {
  default: "bg-brand-green text-bg",
  warning: "bg-warning text-bg",
  danger: "bg-danger text-text-primary",
};

const dotStyles: Record<
  NonNullable<SidebarLinkProps["badgeVariant"]>,
  string
> = {
  default: "bg-brand-green",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function SidebarLink({
  href,
  label,
  icon,
  active = false,
  badge,
  badgeVariant = "default",
  collapsed = false,
}: SidebarLinkProps) {
  const tieneBadge = !!badge && badge > 0;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150",
        collapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2.5",
        active
          ? "bg-brand-green/[0.08] text-text-primary"
          : "text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary"
      )}
    >
      {/* Barra de acento del item activo (solo expandido) */}
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-green" />
      )}

      <span className={cn("flex items-center", collapsed ? "" : "gap-3")}>
        <span
          className={cn(
            "relative transition-colors duration-150",
            active
              ? "text-brand-green"
              : "text-text-muted group-hover:text-text-secondary"
          )}
        >
          {icon}
          {/* Colapsado: el badge se reduce a un punto sobre el ícono */}
          {collapsed && tieneBadge && (
            <span
              className={cn(
                "absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-sidebar",
                dotStyles[badgeVariant]
              )}
            />
          )}
        </span>
        {!collapsed && label}
      </span>

      {!collapsed && tieneBadge && (
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
