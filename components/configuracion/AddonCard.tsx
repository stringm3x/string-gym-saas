"use client";

import {
  LuGlobe,
  LuSparkles,
  LuBot,
  LuCircleUser,
  LuQrCode,
  LuCreditCard,
  LuReceipt,
  LuPlug,
} from "react-icons/lu";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { formatMoneda } from "@/lib/utils/format";
import {
  whatsappContratarAddon,
  whatsappNotificarAddon,
  whatsappCancelarAddon,
} from "@/lib/utils/whatsapp-soporte";
import type { AddonDefinition } from "@/lib/addons";
import type { GymAddon } from "@/lib/queries/addons.queries";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LuGlobe,
  LuSparkles,
  LuBot,
  LuCircleUser,
  LuQrCode,
  LuCreditCard,
  LuReceipt,
};

export function AddonIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? LuPlug;
  return <Icon className={className} />;
}

const estadoBadge: Record<AddonDefinition["estado"], { variant: BadgeVariant; label: string }> = {
  disponible: { variant: "neutral", label: "Disponible" },
  proximamente: { variant: "warning", label: "Próximamente" },
  en_desarrollo: { variant: "neutral", label: "En desarrollo" },
};

interface AddonCardProps {
  addon: AddonDefinition;
  gymAddon?: GymAddon;
  gymNombre: string;
  onOpenDetail: () => void;
}

export function AddonCard({
  addon,
  gymAddon,
  gymNombre,
  onOpenDetail,
}: AddonCardProps) {
  const activo = gymAddon?.estado === "activo";
  const badge = activo
    ? { variant: "success" as BadgeVariant, label: "Activo" }
    : estadoBadge[addon.estado];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-text-muted">
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex items-start gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
          <AddonIcon name={addon.iconName} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary">
              {addon.nombre}
            </p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            {addon.descripcionCorta}
          </p>
        </div>
      </button>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
          {formatMoneda(addon.precio)}
          <span className="text-xs font-normal text-text-muted">/mes</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDetail}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Más info
          </button>

          {activo ? (
            <a
              href={whatsappCancelarAddon(gymNombre, addon.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-danger/40 hover:text-danger"
            >
              Cancelar
            </a>
          ) : addon.estado === "disponible" ? (
            <a
              href={whatsappContratarAddon(gymNombre, addon.nombre, addon.precio)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-brand-green/90"
            >
              Contratar
            </a>
          ) : (
            <a
              href={whatsappNotificarAddon(gymNombre, addon.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-brand-green transition-colors hover:bg-brand-green/10"
            >
              Avísame
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
