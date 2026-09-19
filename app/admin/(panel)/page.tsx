import Link from "next/link";
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
import { TenantEstadoBadge } from "@/components/admin/TenantsTable";
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

const LINK =
  "text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline";

/**
 * Panel interno: mismo ritmo que "Panel del día" del gym. Kicker mono,
 * título en Geist, cifras, y tres tarjetas con listas de 44px.
 */
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Panel interno
        </p>
        <h1 className="text-pagina font-semibold text-text-primary">Panel</h1>
        <p className="text-sm text-text-secondary">
          Hola, {admin?.nombre ?? "admin"}. Panorama global de STRING GYM.
        </p>
      </div>

      <AdminDashboardCards metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TenantsAtencionList data={atencion} />

        <div className="flex flex-col gap-4">
          {/* Últimos gimnasios */}
          <section className="card-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-text-primary">
                Últimos registrados
              </h3>
              <Link href="/admin/tenants" className={LINK}>
                Ver todos
              </Link>
            </div>
            {ultimosTenants.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                Sin gimnasios.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ultimosTenants.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="flex min-h-11 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-hover/60"
                    >
                      <span className="truncate text-sm text-text-primary">
                        {t.nombre}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-text-muted">
                        {PLAN_LABEL[t.plan as Plan] ?? t.plan}
                        <TenantEstadoBadge estado={t.estado} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Últimas acciones */}
          <section className="card-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-text-primary">
                Últimas acciones
              </h3>
              <Link href="/admin/eventos" className={LINK}>
                Ver bitácora
              </Link>
            </div>
            {ultimosEventos.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                Sin actividad.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ultimosEventos.rows.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-text-primary">
                        {ACCION_LABEL[e.accion] ?? e.accion}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                        {fechaHora(e.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {e.tenant_nombre ?? "—"} · {e.admin_email}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
