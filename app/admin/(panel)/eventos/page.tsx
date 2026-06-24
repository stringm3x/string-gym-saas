import {
  getAdminEventosLog,
  listTenantsAdmin,
} from "@/lib/queries/admin.queries";
import { AdminEventosTable } from "@/components/admin/AdminEventosTable";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  };
  const page = Math.max(1, Number(pick("page") ?? "1") || 1);

  const [result, tenants] = await Promise.all([
    getAdminEventosLog(
      {
        accion: pick("accion"),
        tenantId: pick("tenant"),
        desde: pick("desde"),
        hasta: pick("hasta"),
      },
      page,
      20
    ),
    listTenantsAdmin({ orden: "nombre" }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Audit log</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Todas las acciones administrativas, con filtros y exportación.
        </p>
      </div>

      <AdminEventosTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        tenants={tenants.map((t) => ({ id: t.id, nombre: t.nombre }))}
      />
    </div>
  );
}
