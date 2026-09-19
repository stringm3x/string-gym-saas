import { listTenantsAdmin } from "@/lib/queries/admin.queries";
import { TenantsFilters } from "@/components/admin/TenantsFilters";
import { TenantsTable } from "@/components/admin/TenantsTable";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  };

  const rows = await listTenantsAdmin({
    estado: pick("estado"),
    plan: pick("plan"),
    antiguedad: pick("antiguedad"),
    search: pick("search"),
    orden: pick("orden"),
  });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Panel interno
        </p>
        <h1 className="text-pagina font-semibold text-text-primary">Gimnasios</h1>
        <p className="text-sm text-text-secondary">
          <span className="font-mono tabular-nums">{rows.length}</span>{" "}
          {rows.length === 1 ? "gimnasio registrado" : "gimnasios registrados"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <TenantsFilters />
        <TenantsTable rows={rows} />
      </div>
    </div>
  );
}
