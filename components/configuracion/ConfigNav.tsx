"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { hasFeature, type Feature, type Plan } from "@/lib/features";
import type { StaffRol } from "@/lib/types/staff";

interface ConfigNavProps {
  slug: string;
  plan: Plan;
  role: StaffRol;
}

interface Item {
  label: string;
  href: string;
  feature?: Feature;
  ownerOnly?: boolean;
}

export function ConfigNav({ slug, plan, role }: ConfigNavProps) {
  const pathname = usePathname();
  const base = `/${slug}/configuracion`;

  const grupos: { titulo: string; items: Item[] }[] = [
    {
      titulo: "Gimnasio",
      items: [
        { label: "Datos del gym", href: `${base}/gym` },
        { label: "Marca", href: `${base}/marca` },
        { label: "Planes", href: `${base}/planes` },
        { label: "Promociones", href: `${base}/promociones`, feature: "promociones" },
      ],
    },
    {
      titulo: "Equipo",
      items: [{ label: "Staff", href: `${base}/staff`, ownerOnly: true }],
    },
    {
      titulo: "Módulos",
      items: [
        { label: "Clases", href: `${base}/clases`, ownerOnly: true, feature: "clases" },
        { label: "API", href: `${base}/api`, ownerOnly: true, feature: "api" },
        { label: "Pagos", href: `${base}/pagos`, ownerOnly: true, feature: "mercadopago" },
      ],
    },
    {
      titulo: "Datos",
      items: [
        { label: "Tags", href: `${base}/tags`, feature: "tags" },
        { label: "Plantillas", href: `${base}/plantillas`, feature: "plantillas_mensaje" },
        { label: "Add-ons", href: `${base}/addons` },
      ],
    },
    {
      titulo: "Ayuda",
      items: [{ label: "Guía de inicio", href: `/${slug}/onboarding` }],
    },
  ];

  const visible = (i: Item) =>
    (!i.feature || hasFeature(plan, i.feature)) &&
    (!i.ownerOnly || role === "owner");

  return (
    <nav className="flex flex-col gap-5">
      {grupos.map((g) => {
        const items = g.items.filter(visible);
        if (items.length === 0) return null;
        return (
          <div key={g.titulo}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {g.titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const active = pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                        active
                          ? "bg-brand-green/[0.08] text-text-primary"
                          : "text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-green" />
                      )}
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
