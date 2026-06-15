"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { Plan } from "@/lib/features";

interface SidebarWithActiveSectionProps {
  slug: string;
  plan: Plan;
  badges?: {
    miembros?: number;
    inventario?: number;
    prospectos?: number;
  };
}

/**
 * Deriva la sección activa del pathname actual, ej:
 * /gym-demo/miembros/123 -> "miembros"
 */
export function SidebarWithActiveSection({
  slug,
  plan,
  badges,
}: SidebarWithActiveSectionProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] = slug, segments[1] = sección
  const activeSection = segments[1] ?? "dashboard";

  return (
    <Sidebar
      slug={slug}
      plan={plan}
      activeSection={activeSection}
      badges={badges}
    />
  );
}
