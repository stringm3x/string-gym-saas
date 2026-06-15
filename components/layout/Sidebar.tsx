import {
  LuLayoutDashboard,
  LuUsers,
  LuScanLine,
  LuWallet,
  LuPackage,
  LuTarget,
} from "react-icons/lu";
import { SidebarLink } from "./SidebarLink";
import { hasFeature, type Plan } from "@/lib/features";

interface SidebarProps {
  slug: string;
  plan: Plan;
  activeSection: string;
  /**
   * Badges ambientales — se calculan en el layout vía queries
   * (lib/queries/*) y se pasan ya resueltos.
   * Ejemplo: { miembros: vencenHoy, inventario: stockBajo }
   */
  badges?: {
    miembros?: number;
    inventario?: number;
    prospectos?: number;
  };
}

export function Sidebar({
  slug,
  plan,
  activeSection,
  badges = {},
}: SidebarProps) {
  const base = `/${slug}`;

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-bg px-3 py-6">
      <div className="mb-8 px-3">
        <span className="font-display text-xl uppercase tracking-wide text-text-primary">
          STRING<span className="text-brand-green">GYM</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <SidebarLink
          href={`${base}/dashboard`}
          label="Dashboard"
          icon={<LuLayoutDashboard size={18} />}
          active={activeSection === "dashboard"}
        />

        <SidebarLink
          href={`${base}/miembros`}
          label="Miembros"
          icon={<LuUsers size={18} />}
          active={activeSection === "miembros"}
          badge={badges.miembros}
          badgeVariant="warning"
        />

        <SidebarLink
          href={`${base}/checkins`}
          label="Check-in"
          icon={<LuScanLine size={18} />}
          active={activeSection === "checkins"}
        />

        <SidebarLink
          href={`${base}/caja`}
          label="Caja"
          icon={<LuWallet size={18} />}
          active={activeSection === "caja"}
        />

        {hasFeature(plan, "inventario") && (
          <SidebarLink
            href={`${base}/inventario`}
            label="Inventario"
            icon={<LuPackage size={18} />}
            active={activeSection === "inventario"}
            badge={badges.inventario}
            badgeVariant="danger"
          />
        )}

        {hasFeature(plan, "prospectos") && (
          <SidebarLink
            href={`${base}/prospectos`}
            label="Prospectos"
            icon={<LuTarget size={18} />}
            active={activeSection === "prospectos"}
            badge={badges.prospectos}
          />
        )}
      </nav>
    </aside>
  );
}
