"use client";

import Image from "next/image";
import {
  LuSunrise,
  LuLayoutDashboard,
  LuUsers,
  LuScanLine,
  LuWallet,
  LuPackage,
  LuTarget,
  LuBell,
  LuSettings,
} from "react-icons/lu";
import { SidebarLink } from "./SidebarLink";
import { hasFeature, type Plan } from "@/lib/features";
import { useStaff } from "@/lib/contexts/StaffContext";

interface SidebarProps {
  slug: string;
  plan: Plan;
  activeSection: string;
  gymNombre: string;
  logoUrl?: string | null;
  /**
   * Badges ambientales — se calculan en el layout vía queries
   * (lib/queries/*) y se pasan ya resueltos.
   * Ejemplo: { miembros: vencenHoy, inventario: stockBajo }
   */
  badges?: {
    miembros?: number;
    inventario?: number;
    prospectos?: number;
    alertas?: number;
  };
}

export function Sidebar({
  slug,
  plan,
  activeSection,
  gymNombre,
  logoUrl,
  badges = {},
}: SidebarProps) {
  const base = `/${slug}`;
  const { can } = useStaff();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar px-3 py-6">
      <div className="mb-8 flex h-10 items-center px-3">
        {logoUrl ? (
          <div className="relative h-10 w-full">
            <Image
              src={logoUrl}
              alt={gymNombre}
              fill
              sizes="200px"
              className="object-contain object-left"
              unoptimized
              priority
            />
          </div>
        ) : (
          <span className="truncate font-display text-xl uppercase tracking-wide text-text-primary">
            {gymNombre || "Mi Gym"}
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {hasFeature(plan, "pantalla_hoy") && can("ver_pantalla_hoy") && (
          <SidebarLink
            href={`${base}/hoy`}
            label="Hoy"
            icon={<LuSunrise size={18} />}
            active={activeSection === "hoy"}
          />
        )}

        {can("ver_dashboard_completo") && (
          <SidebarLink
            href={`${base}/dashboard`}
            label="Dashboard"
            icon={<LuLayoutDashboard size={18} />}
            active={activeSection === "dashboard"}
          />
        )}

        {can("crear_miembros") && (
          <SidebarLink
            href={`${base}/miembros`}
            label="Miembros"
            icon={<LuUsers size={18} />}
            active={activeSection === "miembros"}
            badge={badges.miembros}
            badgeVariant="warning"
          />
        )}

        {can("ver_checkins_dia") && (
          <SidebarLink
            href={`${base}/checkins`}
            label="Check-in"
            icon={<LuScanLine size={18} />}
            active={activeSection === "checkins"}
          />
        )}

        {can("registrar_pagos") && (
          <SidebarLink
            href={`${base}/caja`}
            label="Caja"
            icon={<LuWallet size={18} />}
            active={activeSection === "caja"}
          />
        )}

        {hasFeature(plan, "inventario") && can("ver_inventario_stock") && (
          <SidebarLink
            href={`${base}/inventario`}
            label="Inventario"
            icon={<LuPackage size={18} />}
            active={activeSection === "inventario"}
            badge={badges.inventario}
            badgeVariant="danger"
          />
        )}

        {hasFeature(plan, "prospectos") && can("ver_prospectos") && (
          <SidebarLink
            href={`${base}/prospectos`}
            label="Prospectos"
            icon={<LuTarget size={18} />}
            active={activeSection === "prospectos"}
            badge={badges.prospectos}
          />
        )}

        {hasFeature(plan, "alertas_dueno") && can("ver_alertas") && (
          <SidebarLink
            href={`${base}/alertas`}
            label="Alertas"
            icon={<LuBell size={18} />}
            active={activeSection === "alertas"}
            badge={badges.alertas}
            badgeVariant="danger"
          />
        )}
      </nav>

      {can("configurar_general") && (
        <div className="mt-auto border-t border-border pt-3">
          <SidebarLink
            href={`${base}/configuracion`}
            label="Configuración"
            icon={<LuSettings size={18} />}
            active={activeSection === "configuracion"}
          />
        </div>
      )}
    </aside>
  );
}
