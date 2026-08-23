import Link from "next/link";
import { LuPlus, LuUsers, LuUpload, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listMiembros } from "@/lib/queries/miembros.queries";
import { listTags } from "@/lib/queries/tags.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { listSeguimientosPendientes } from "@/lib/queries/notas.queries";
import { hoyISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiembrosToolbar } from "@/components/miembros/MiembrosToolbar";
import { MiembrosListClient } from "@/components/miembros/MiembrosListClient";
import { SeguimientosPendientes } from "@/components/miembros/SeguimientosPendientes";

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    filter?: string;
    tags?: string;
    archivado?: string;
    origen?: string;
    page?: string;
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
    sp.filter === "por_vencer" ||
    sp.filter === "sin_telefono"
      ? sp.filter
      : "all";

  const soloArchivados = sp.archivado === "true";
  const origen =
    sp.origen === "manual" || sp.origen === "csv" ? sp.origen : "todos";
  const tagIds = (sp.tags ?? "").split(",").filter(Boolean);
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ miembros, total }, availableTags, plantillas, seguimientosPendientes] =
    await Promise.all([
      listMiembros({
        tenantId: tenant.id,
        search: sp.q,
        filter,
        tagIds,
        soloArchivados,
        origen,
        page,
        pageSize: PAGE_SIZE,
      }),
      listTags(tenant.id),
      listPlantillas(tenant.id, { soloActivas: true }),
      listSeguimientosPendientes(tenant.id, hoyISO()),
    ]);

  const isOwner = tenant.role === "owner";

  const isFiltered = filter !== "all" || Boolean(sp.q) || tagIds.length > 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefPagina(p: number): string {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.filter) params.set("filter", sp.filter);
    if (sp.tags) params.set("tags", sp.tags);
    if (sp.archivado) params.set("archivado", sp.archivado);
    if (sp.origen) params.set("origen", sp.origen);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/${slug}/miembros?${qs}` : `/${slug}/miembros`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Miembros
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {total === 0
              ? "Sin miembros"
              : `${total} ${total === 1 ? "miembro" : "miembros"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <Link href={`/${slug}/miembros/importar`}>
              <Button
                variant="secondary"
                leftIcon={<LuUpload className="h-4 w-4" />}
              >
                Importar CSV
              </Button>
            </Link>
          )}
          <Link href={`/${slug}/miembros/nuevo`}>
            <Button leftIcon={<LuPlus className="h-4 w-4" />}>
              Nuevo miembro
            </Button>
          </Link>
        </div>
      </div>

      <SeguimientosPendientes pendientes={seguimientosPendientes} slug={slug} />

      <MiembrosToolbar availableTags={availableTags} plan={tenant.plan} />

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
        <>
          <MiembrosListClient
            miembros={miembros}
            slug={slug}
            availableTags={availableTags}
            plantillas={plantillas}
            plan={tenant.plan}
            soloArchivados={soloArchivados}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-text-muted">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={hrefPagina(page - 1)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary",
                    page <= 1 && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={page <= 1}
                >
                  <LuChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Link>
                <Link
                  href={hrefPagina(page + 1)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary",
                    page >= totalPages && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={page >= totalPages}
                >
                  Siguiente <LuChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
