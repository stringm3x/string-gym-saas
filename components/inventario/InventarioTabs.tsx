"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface InventarioTabsProps {
  slug: string;
  stockBajoCount: number;
  canMovimientos?: boolean;
}

// Pestañas del sistema: bloque con borde, activo con fondo lleno y borde
// ácido (sin barra inferior). 44px de alto para tablet.
export function InventarioTabs({
  slug,
  stockBajoCount,
  canMovimientos = true,
}: InventarioTabsProps) {
  const pathname = usePathname();
  const base = `/${slug}/inventario`;

  const tabs = [
    { href: `${base}/productos`, label: "Productos", badge: stockBajoCount },
    ...(canMovimientos
      ? [{ href: `${base}/movimientos`, label: "Movimientos", badge: 0 }]
      : []),
  ];

  return (
    <nav aria-label="Secciones de inventario" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center gap-2 border px-4 text-sm transition-colors duration-150",
              active
                ? "border-brand-green bg-surface-hover font-semibold text-brand-green"
                : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center bg-danger px-1.5 font-mono text-xs font-bold tabular-nums text-text-primary">
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
