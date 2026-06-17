"use client";

import { LuCheck } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatMoneda } from "@/lib/utils/format";
import { AddonIcon } from "./AddonCard";
import { planCumpleAddon, type AddonDefinition } from "@/lib/addons";
import { PLAN_LABELS, type Plan } from "@/lib/features";
import {
  whatsappContratarAddon,
  whatsappNotificarAddon,
  whatsappCancelarAddon,
} from "@/lib/utils/whatsapp-soporte";
import type { GymAddon } from "@/lib/queries/addons.queries";

interface AddonDetailModalProps {
  addon: AddonDefinition | null;
  gymAddon?: GymAddon;
  planActual: Plan;
  gymNombre: string;
  open: boolean;
  onClose: () => void;
}

export function AddonDetailModal({
  addon,
  gymAddon,
  planActual,
  gymNombre,
  open,
  onClose,
}: AddonDetailModalProps) {
  if (!addon) return null;

  const activo = gymAddon?.estado === "activo";
  const cumplePlan = planCumpleAddon(planActual, addon.planMinimo);

  return (
    <Modal open={open} onClose={onClose} title={addon.nombre} size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
            <AddonIcon name={addon.iconName} className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="text-sm text-text-secondary">
              {addon.descripcionLarga}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            Qué incluye
          </p>
          <ul className="space-y-2">
            {addon.beneficios.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-sm text-text-secondary"
              >
                <LuCheck className="h-4 w-4 shrink-0 text-brand-green" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted">
              Precio
            </p>
            <p className="font-mono text-xl font-bold tabular-nums text-text-primary">
              {formatMoneda(addon.precio)}
              <span className="text-sm font-normal text-text-muted">/mes</span>
            </p>
          </div>
          {!cumplePlan && (
            <Badge variant="warning">
              Requiere Plan {PLAN_LABELS[addon.planMinimo]}
            </Badge>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          {activo ? (
            <a
              href={whatsappCancelarAddon(gymNombre, addon.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-danger/40 hover:text-danger"
            >
              Cancelar add-on
            </a>
          ) : addon.estado === "disponible" ? (
            <a
              href={whatsappContratarAddon(gymNombre, addon.nombre, addon.precio)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-green/90"
            >
              Contratar add-on
            </a>
          ) : (
            <a
              href={whatsappNotificarAddon(gymNombre, addon.nombre)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-brand-green/40 px-4 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-brand-green/10"
            >
              Avísame cuando esté listo
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
