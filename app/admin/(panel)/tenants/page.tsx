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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Tenants</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {rows.length} {rows.length === 1 ? "gym registrado" : "gyms registrados"}
        </p>
      </div>

      <TenantsFilters />
      <TenantsTable rows={rows} />
    </div>
  );
}
