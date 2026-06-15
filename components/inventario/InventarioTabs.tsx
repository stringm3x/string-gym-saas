"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface InventarioTabsProps {
  slug: string;
  stockBajoCount: number;
}

export function InventarioTabs({ slug, stockBajoCount }: InventarioTabsProps) {
  const pathname = usePathname();
  const base = `/${slug}/inventario`;

  const tabs = [
    { href: `${base}/productos`, label: "Productos", badge: stockBajoCount },
    { href: `${base}/movimientos`, label: "Movimientos", badge: 0 },
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-mono text-xs font-bold text-text-primary tabular-nums">
                {t.badge}
              </span>
            )}
            {active && (
              <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand-green" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
