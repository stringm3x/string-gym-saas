import Link from "next/link";
import { LuPlus, LuUsers } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listMiembros } from "@/lib/queries/miembros.queries";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiembrosToolbar } from "@/components/miembros/MiembrosToolbar";
import { MiembrosTable } from "@/components/miembros/MiembrosTable";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function MiembrosPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, sp, tenant] = await Promise.all([
    params,
    searchParams,
    getTenant(),
  ]);

  const filter =
    sp.filter === "activos" ||
    sp.filter === "inactivos" ||
    sp.filter === "por_vencer"
      ? sp.filter
      : "all";

  const miembros = await listMiembros({
    tenantId: tenant.id,
    search: sp.q,
    filter,
  });

  const isFiltered = filter !== "all" || Boolean(sp.q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Miembros
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {miembros.length === 0
              ? "Sin miembros"
              : `${miembros.length} ${
                  miembros.length === 1 ? "miembro" : "miembros"
                }`}
          </p>
        </div>

        <Link href={`/${slug}/miembros/nuevo`}>
          <Button leftIcon={<LuPlus className="h-4 w-4" />}>
            Nuevo miembro
          </Button>
        </Link>
      </div>

      <MiembrosToolbar />

      {miembros.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={<LuUsers className="h-5 w-5" />}
            title="Sin resultados"
            description="No hay miembros que coincidan con la búsqueda o el filtro actual."
          />
        ) : (
          <EmptyState
            icon={<LuUsers className="h-5 w-5" />}
            title="Aún no hay miembros"
            description="Cuando registres a tu primer miembro, aparecerá aquí con su estado de membresía y datos de contacto."
            action={
              <Link href={`/${slug}/miembros/nuevo`}>
                <Button leftIcon={<LuPlus className="h-4 w-4" />}>
                  Registrar primer miembro
                </Button>
              </Link>
            }
          />
        )
      ) : (
        <MiembrosTable miembros={miembros} slug={slug} />
      )}
    </div>
  );
}
