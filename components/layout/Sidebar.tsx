"use client";

import { useState } from "react";
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
  LuMegaphone,
  LuMessageCircle,
  LuStar,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from "react-icons/lu";
import { SidebarLink } from "./SidebarLink";
import { LogotipoVertical } from "./LogotipoVertical";
import { MarcasRegistro } from "@/components/arte/MarcasRegistro";
import { hasFeature, type Plan } from "@/lib/features";
import { useStaff } from "@/lib/contexts/StaffContext";

interface SidebarProps {
  slug: string;
  plan: Plan;
  activeSection: string;
  gymNombre: string;
  logoUrl?: string | null;
  /** Estado inicial de colapso, leído de cookie en el layout (evita flash). */
  initialCollapsed?: boolean;
  /**
   * Badges ambientales — se calculan en el layout vía queries
   * (lib/queries/*) y se pasan ya resueltos.
   */
  badges?: {
    miembros?: number;
    inventario?: number;
    prospectos?: number;
    alertas?: number;
    caja?: number;
    whatsapp?: number;
  };
}

function SectionLabel({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="mx-3 my-2 border-t border-border" />;
  }
  return (
    <p className="px-5 pb-1 pt-5 font-mono text-etiqueta uppercase text-text-muted">
      {children}
    </p>
  );
}

/** Monograma S de STRING: negro sobre ácido, como el logo. */
function Monograma() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center bg-brand-green font-display text-lg leading-none text-on-brand"
    >
      S
    </span>
  );
}

/**
 * Menú lateral del panel del gimnasio. Aquí manda el verde de STRING (es lo
 * que ve el staff); el color del gimnasio vive en portal, kiosco y recibos.
 * Fondo fondo-elevado, ítems a sangre, activo con fondo lleno.
 */
export function Sidebar({
  slug,
  plan,
  activeSection,
  gymNombre,
  logoUrl,
  initialCollapsed = false,
  badges = {},
}: SidebarProps) {
  const base = `/${slug}`;
  const { can } = useStaff();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `sidebar_collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

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
    // Campañas/opiniones: nivel administración (owner + gerente).
    campanas: hasFeature(plan, "campanas") && can("ver_dashboard_ingresos"),
    // Inbox: owner y recepción (contestar es operación diaria de ambos).
    whatsapp: hasFeature(plan, "whatsapp_automatico"),
    opiniones: hasFeature(plan, "opiniones") && can("ver_dashboard_ingresos"),
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-sidebar py-6 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Marca: logo del gym o monograma S + nombre */}
      <div
        className={
          collapsed
            ? "mb-4 flex justify-center"
            : "relative mb-4 flex items-center gap-3 px-5 py-2"
        }
      >
        {!collapsed && <MarcasRegistro className="text-text-muted/40" />}
        {logoUrl ? (
          <div
            className={collapsed ? "relative h-8 w-8" : "relative h-10 w-full"}
          >
            <Image
              src={logoUrl}
              alt={gymNombre}
              fill
              sizes="200px"
              className={
                collapsed ? "object-contain" : "object-contain object-left"
              }
              unoptimized
              priority
            />
          </div>
        ) : (
          <>
            <Monograma />
            {!collapsed && (
              <span className="truncate text-[15px] font-semibold leading-5 text-text-primary">
                {gymNombre || "Mi gimnasio"}
              </span>
            )}
          </>
        )}
      </div>

      <nav className="flex flex-col overflow-y-auto overflow-x-hidden">
        {v.hoy && (
          <SidebarLink
            href={`${base}/hoy`}
            label="Hoy"
            icon={<LuSunrise size={18} />}
            active={activeSection === "hoy"}
            collapsed={collapsed}
          />
        )}
        {v.dashboard && (
          <SidebarLink
            href={`${base}/dashboard`}
            label="Panel"
            icon={<LuLayoutDashboard size={18} />}
            active={activeSection === "dashboard"}
            collapsed={collapsed}
          />
        )}

        {(v.miembros || v.checkins || v.caja || v.cuentasPorCobrar) && (
          <SectionLabel collapsed={collapsed}>Operación</SectionLabel>
        )}
        {v.miembros && (
          <SidebarLink
            href={`${base}/miembros`}
            label="Miembros"
            icon={<LuUsers size={18} />}
            active={activeSection === "miembros"}
            badge={badges.miembros}
            badgeVariant="warning"
            collapsed={collapsed}
          />
        )}
        {v.checkins && (
          <SidebarLink
            href={`${base}/checkins`}
            label="Check-in"
            icon={<LuScanLine size={18} />}
            active={activeSection === "checkins"}
            collapsed={collapsed}
          />
        )}
        {v.caja && (
          <SidebarLink
            href={`${base}/caja`}
            label="Caja"
            icon={<LuWallet size={18} />}
            active={activeSection === "caja"}
            badge={badges.caja}
            badgeVariant="danger"
            collapsed={collapsed}
          />
        )}
        {v.cuentasPorCobrar && (
          <SidebarLink
            href={`${base}/cuentas-por-cobrar`}
            label="Cuentas por cobrar"
            icon={<LuHandCoins size={18} />}
            active={activeSection === "cuentas-por-cobrar"}
            collapsed={collapsed}
          />
        )}

        {(v.clases || v.inventario) && (
          <SectionLabel collapsed={collapsed}>Módulos</SectionLabel>
        )}
        {v.clases && (
          <SidebarLink
            href={`${base}/clases`}
            label="Clases"
            icon={<LuCalendarDays size={18} />}
            active={activeSection === "clases"}
            collapsed={collapsed}
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
            collapsed={collapsed}
          />
        )}

        {(v.prospectos ||
          v.alertas ||
          v.campanas ||
          v.whatsapp ||
          v.opiniones) && (
          <SectionLabel collapsed={collapsed}>Clientes</SectionLabel>
        )}
        {v.prospectos && (
          <SidebarLink
            href={`${base}/prospectos`}
            label="Prospectos"
            icon={<LuTarget size={18} />}
            active={activeSection === "prospectos"}
            badge={badges.prospectos}
            collapsed={collapsed}
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
            collapsed={collapsed}
          />
        )}
        {v.campanas && (
          <SidebarLink
            href={`${base}/comunicaciones/campanas`}
            label="Campañas"
            icon={<LuMegaphone size={18} />}
            active={activeSection === "comunicaciones/campanas"}
            collapsed={collapsed}
          />
        )}
        {v.whatsapp && (
          <SidebarLink
            href={`${base}/comunicaciones/whatsapp`}
            label="WhatsApp"
            icon={<LuMessageCircle size={18} />}
            active={activeSection === "comunicaciones/whatsapp"}
            badge={badges.whatsapp}
            badgeVariant="danger"
            collapsed={collapsed}
          />
        )}
        {v.opiniones && (
          <SidebarLink
            href={`${base}/opiniones`}
            label="Opiniones"
            icon={<LuStar size={18} />}
            active={activeSection === "opiniones"}
            collapsed={collapsed}
          />
        )}
      </nav>

      {/* Firma: logotipo vertical, como al costado de una sección del sitio */}
      {collapsed ? <div className="flex-1" /> : <LogotipoVertical />}

      <div className="flex flex-col pt-3">
        <div className="mb-1 border-t border-border" />
        {can("configurar_general") && (
          <SidebarLink
            href={`${base}/configuracion`}
            label="Configuración"
            icon={<LuSettings size={18} />}
            active={activeSection === "configuracion"}
            collapsed={collapsed}
          />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={`flex h-11 items-center text-sm text-text-muted transition-colors hover:bg-surface-hover/60 hover:text-text-primary ${
            collapsed ? "justify-center px-0" : "gap-3 px-5"
          }`}
        >
          {collapsed ? (
            <LuPanelLeftOpen size={18} />
          ) : (
            <>
              <LuPanelLeftClose size={18} /> Colapsar
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
