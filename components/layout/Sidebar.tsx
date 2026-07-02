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
  LuCalendarDays,
  LuHandCoins,
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  );
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

  // Visibilidad por item (rol + plan).
  const v = {
    hoy: hasFeature(plan, "pantalla_hoy") && can("ver_pantalla_hoy"),
    dashboard: can("ver_dashboard_completo"),
    miembros: can("crear_miembros"),
    checkins: can("ver_checkins_dia"),
    caja: can("registrar_pagos"),
    cuentasPorCobrar: hasFeature(plan, "creditos") && can("registrar_pagos"),
    clases: hasFeature(plan, "clases") && can("ver_clases"),
    inventario: hasFeature(plan, "inventario") && can("ver_inventario_stock"),
    prospectos: hasFeature(plan, "prospectos") && can("ver_prospectos"),
    alertas: hasFeature(plan, "alertas_dueno") && can("ver_alertas"),
  };

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar px-3 py-6">
      {/* Marca: logo del gym si lo subió; si no, wordmark STRING GYM + nombre */}
      <div className="mb-4 px-3">
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
          <>
            <span className="font-display text-xl uppercase tracking-wide text-text-primary">
              STRING<span className="text-brand-green">GYM</span>
            </span>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {gymNombre || "Mi Gym"}
            </p>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {v.hoy && (
          <SidebarLink
            href={`${base}/hoy`}
            label="Hoy"
            icon={<LuSunrise size={18} />}
            active={activeSection === "hoy"}
          />
        )}
        {v.dashboard && (
          <SidebarLink
            href={`${base}/dashboard`}
            label="Dashboard"
            icon={<LuLayoutDashboard size={18} />}
            active={activeSection === "dashboard"}
          />
        )}

        {(v.miembros || v.checkins || v.caja || v.cuentasPorCobrar) && (
          <SectionLabel>Operación</SectionLabel>
        )}
        {v.miembros && (
          <SidebarLink
            href={`${base}/miembros`}
            label="Miembros"
            icon={<LuUsers size={18} />}
            active={activeSection === "miembros"}
            badge={badges.miembros}
            badgeVariant="warning"
          />
        )}
        {v.checkins && (
          <SidebarLink
            href={`${base}/checkins`}
            label="Check-in"
            icon={<LuScanLine size={18} />}
            active={activeSection === "checkins"}
          />
        )}
        {v.caja && (
          <SidebarLink
            href={`${base}/caja`}
            label="Caja"
            icon={<LuWallet size={18} />}
            active={activeSection === "caja"}
          />
        )}
        {v.cuentasPorCobrar && (
          <SidebarLink
            href={`${base}/cuentas-por-cobrar`}
            label="Cuentas por cobrar"
            icon={<LuHandCoins size={18} />}
            active={activeSection === "cuentas-por-cobrar"}
          />
        )}

        {(v.clases || v.inventario) && <SectionLabel>Módulos</SectionLabel>}
        {v.clases && (
          <SidebarLink
            href={`${base}/clases`}
            label="Clases"
            icon={<LuCalendarDays size={18} />}
            active={activeSection === "clases"}
          />
        )}
        {v.inventario && (
          <SidebarLink
            href={`${base}/inventario`}
            label="Inventario"
            icon={<LuPackage size={18} />}
            active={activeSection === "inventario"}
            badge={badges.inventario}
            badgeVariant="danger"
          />
        )}

        {(v.prospectos || v.alertas) && <SectionLabel>CRM</SectionLabel>}
        {v.prospectos && (
          <SidebarLink
            href={`${base}/prospectos`}
            label="Prospectos"
            icon={<LuTarget size={18} />}
            active={activeSection === "prospectos"}
            badge={badges.prospectos}
          />
        )}
        {v.alertas && (
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
        <div className="mt-auto pt-3">
          <div className="mb-2 border-t border-border" />
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
