"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import type { Plan } from "@/lib/features";

interface SidebarWithActiveSectionProps {
  slug: string;
  plan: Plan;
  gymNombre: string;
  logoUrl?: string | null;
  initialCollapsed?: boolean;
  badges?: {
    miembros?: number;
    inventario?: number;
    prospectos?: number;
    alertas?: number;
  };
}

/**
 * Deriva la sección activa del pathname actual, ej:
 * /gym-demo/miembros/123 -> "miembros"
 */
export function SidebarWithActiveSection({
  slug,
  plan,
  gymNombre,
  logoUrl,
  initialCollapsed,
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
      gymNombre={gymNombre}
      logoUrl={logoUrl}
      initialCollapsed={initialCollapsed}
      badges={badges}
    />
  );
}
