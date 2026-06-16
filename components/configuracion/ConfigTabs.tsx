"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface ConfigTabsProps {
  slug: string;
}

export function ConfigTabs({ slug }: ConfigTabsProps) {
  const pathname = usePathname();
  const base = `/${slug}/configuracion`;

  const tabs = [
    { href: `${base}/planes`, label: "Planes" },
    { href: `${base}/promociones`, label: "Promociones" },
    { href: `${base}/tags`, label: "Tags" },
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
              "relative px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand-green" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
