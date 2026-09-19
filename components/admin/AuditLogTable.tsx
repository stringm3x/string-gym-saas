import type { TenantAdminEvent } from "@/lib/queries/admin.queries";
import { TZ_MX } from "@/lib/utils/dates";

/** Etiquetas legibles de las acciones de la bitácora. */
export const ACCION_LABEL: Record<string, string> = {
  "admin.login": "Inicio de sesión admin",
  "tenant.cambiar_plan": "Cambió el plan",
  "tenant.marcar_fundador": "Marcó/quitó fundador",
  "tenant.suspender": "Suspendió el gimnasio",
  "tenant.reactivar": "Reactivó el gimnasio",
  "tenant.activar_plan_pagado": "Activó plan pagado (fin de prueba)",
  "tenant.cancelar": "Canceló el gimnasio",
  "tenant.extender_prueba": "Extendió la prueba",
  "tenant.toggle_addon": "Activó/desactivó complemento",
  "tenant.reset_password_owner": "Restableció la contraseña del dueño",
  "tenant.pago_manual": "Registró pago manual",
  "tenant.nota_interna": "Agregó nota interna",
};

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resumenMeta(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  return parts.join(" · ");
}

// Lista dentro de tarjeta: filas px-5 py-4 con divide-y. La fecha va en mono.
export function AuditLogTable({ events }: { events: TenantAdminEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-secondary">
        Sin acciones administrativas para este gimnasio.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {events.map((e) => {
        const meta = resumenMeta(e.metadata);
        return (
          <li key={e.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary">
                {ACCION_LABEL[e.accion] ?? e.accion}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                {fechaHora(e.created_at)}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {e.admin_email}
              {meta && ` · ${meta}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
