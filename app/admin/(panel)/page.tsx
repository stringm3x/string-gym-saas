import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import {
  getAdminDashboardMetrics,
  getTenantsRequierenAtencion,
  getAdminEventosLog,
  listTenantsAdmin,
} from "@/lib/queries/admin.queries";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { PLAN_LABEL } from "@/lib/admin/pricing";
import type { Plan } from "@/lib/features";
import { AdminDashboardCards } from "@/components/admin/AdminDashboardCards";
import { TenantsAtencionList } from "@/components/admin/TenantsAtencionList";
import { ACCION_LABEL } from "@/components/admin/AuditLogTable";
import { TZ_MX } from "@/lib/utils/dates";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  const [admin, metrics, atencion, ultimosEventos, tenants] = await Promise.all([
    getCurrentAdmin(),
    getAdminDashboardMetrics(),
    getTenantsRequierenAtencion(),
    getAdminEventosLog({}, 1, 5),
    listTenantsAdmin({ orden: "recientes" }),
  ]);

  const ultimosTenants = tenants.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Hola, {admin?.nombre ?? "admin"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Panorama global de STRING GYM.
        </p>
      </div>

      <AdminDashboardCards metrics={metrics} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TenantsAtencionList data={atencion} />

        <div className="space-y-6">
          {/* Últimos tenants */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Últimos registrados
              </h3>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
              >
                Ver todos <LuArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {ultimosTenants.length === 0 ? (
              <p className="text-[11px] text-text-muted">Sin tenants.</p>
            ) : (
              <ul className="space-y-1.5">
                {ultimosTenants.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 hover:bg-surface"
                    >
                      <span className="truncate text-xs font-medium text-text-primary">
                        {t.nombre}
                      </span>
                      <span className="shrink-0 text-[11px] text-text-muted">
                        {PLAN_LABEL[t.plan as Plan] ?? t.plan} · {t.estado}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Últimas acciones */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Últimas acciones
              </h3>
              <Link
                href="/admin/eventos"
                className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
              >
                Ver audit log <LuArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {ultimosEventos.rows.length === 0 ? (
              <p className="text-[11px] text-text-muted">Sin actividad.</p>
            ) : (
              <ul className="space-y-1.5">
                {ultimosEventos.rows.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border bg-bg px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-text-primary">
                        {ACCION_LABEL[e.accion] ?? e.accion}
                      </span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {fechaHora(e.created_at)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {e.tenant_nombre ?? "—"} · {e.admin_email}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
