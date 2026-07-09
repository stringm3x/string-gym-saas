import type { TenantAdminEvent } from "@/lib/queries/admin.queries";
import { TZ_MX } from "@/lib/utils/dates";

/** Etiquetas legibles de las acciones del audit log. */
export const ACCION_LABEL: Record<string, string> = {
  "admin.login": "Inicio de sesión admin",
  "tenant.cambiar_plan": "Cambió el plan",
  "tenant.marcar_fundador": "Marcó/quitó fundador",
  "tenant.suspender": "Suspendió el tenant",
  "tenant.reactivar": "Reactivó el tenant",
  "tenant.cancelar": "Canceló el tenant",
  "tenant.extender_prueba": "Extendió la prueba",
  "tenant.toggle_addon": "Activó/desactivó add-on",
  "tenant.reset_password_owner": "Reseteó password del owner",
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

export function AuditLogTable({ events }: { events: TenantAdminEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
        Sin eventos administrativos para este tenant.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-primary">
              {ACCION_LABEL[e.accion] ?? e.accion}
            </span>
            <span className="shrink-0 text-[10px] text-text-muted">
              {fechaHora(e.created_at)}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {e.admin_email}
            {resumenMeta(e.metadata) && ` · ${resumenMeta(e.metadata)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
