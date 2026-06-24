"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { hasFeature, type Feature, type Plan } from "@/lib/features";
import type { StaffRol } from "@/lib/types/staff";

interface ConfigTabsProps {
  slug: string;
  plan: Plan;
  role: StaffRol;
}

export function ConfigTabs({ slug, plan, role }: ConfigTabsProps) {
  const pathname = usePathname();
  const base = `/${slug}/configuracion`;

  const allTabs: {
    href: string;
    label: string;
    feature?: Feature;
    ownerOnly?: boolean;
  }[] = [
    { href: `${base}/gym`, label: "Gym" },
    { href: `${base}/marca`, label: "Marca" },
    { href: `${base}/addons`, label: "Add-ons" },
    { href: `${base}/staff`, label: "Staff", ownerOnly: true },
    {
      href: `${base}/clases`,
      label: "Clases",
      ownerOnly: true,
      feature: "clases",
    },
    { href: `${base}/planes`, label: "Planes" },
    { href: `${base}/promociones`, label: "Promociones", feature: "promociones" },
    { href: `${base}/tags`, label: "Tags", feature: "tags" },
    {
      href: `${base}/plantillas`,
      label: "Plantillas",
      feature: "plantillas_mensaje",
    },
  ];

  const tabs = allTabs.filter(
    (t) =>
      (!t.feature || hasFeature(plan, t.feature)) &&
      (!t.ownerOnly || role === "owner")
  );

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
