import Link from "next/link";
import { LuPlus, LuUsers } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listMiembros } from "@/lib/queries/miembros.queries";
import { listTags } from "@/lib/queries/tags.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiembrosToolbar } from "@/components/miembros/MiembrosToolbar";
import { MiembrosListClient } from "@/components/miembros/MiembrosListClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    filter?: string;
    tag?: string;
    archivado?: string;
  }>;
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

  const soloArchivados = sp.archivado === "true";

  const [miembros, availableTags, plantillas] = await Promise.all([
    listMiembros({
      tenantId: tenant.id,
      search: sp.q,
      filter,
      tagId: sp.tag,
      soloArchivados,
    }),
    listTags(tenant.id),
    listPlantillas(tenant.id, { soloActivas: true }),
  ]);

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

      <MiembrosToolbar availableTags={availableTags} />

      {miembros.length === 0 ? (
        soloArchivados ? (
          <EmptyState
            icon={<LuUsers className="h-5 w-5" />}
            title="Sin miembros archivados"
            description="Los miembros que archives aparecerán aquí."
          />
        ) : isFiltered ? (
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
        <MiembrosListClient
          miembros={miembros}
          slug={slug}
          availableTags={availableTags}
          plantillas={plantillas}
          soloArchivados={soloArchivados}
        />
      )}
    </div>
  );
}
