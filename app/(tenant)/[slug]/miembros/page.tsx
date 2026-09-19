import Link from "next/link";
import {
  LuPlus,
  LuUsers,
  LuUpload,
  LuChevronLeft,
  LuChevronRight,
  LuSearch,
  LuArchive,
} from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listMiembros } from "@/lib/queries/miembros.queries";
import { listTags } from "@/lib/queries/tags.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { listSeguimientosPendientes } from "@/lib/queries/notas.queries";
import { hoyISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiembrosToolbar } from "@/components/miembros/MiembrosToolbar";
import { MiembrosListClient } from "@/components/miembros/MiembrosListClient";
import { SeguimientosPendientes } from "@/components/miembros/SeguimientosPendientes";

const PAGE_SIZE = 50;

const LINK_PRIMARIO =
  "inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90";
const LINK_SECUNDARIO =
  "inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary";

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
    <div className="flex flex-col gap-7">
      {/* Encabezado: conteo en mono, título en Geist, acciones */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {total === 0
              ? "Sin miembros"
              : `${total} ${total === 1 ? "miembro" : "miembros"}`}
          </p>
          <h2 className="text-pagina font-semibold text-text-primary">
            Miembros
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <Link href={`/${slug}/miembros/importar`} className={LINK_SECUNDARIO}>
              <LuUpload className="h-4 w-4" aria-hidden="true" />
              Importar CSV
            </Link>
          )}
          <Link href={`/${slug}/miembros/nuevo`} className={LINK_PRIMARIO}>
            <LuPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo miembro
          </Link>
        </div>
      </div>

      <SeguimientosPendientes pendientes={seguimientosPendientes} slug={slug} />

      <MiembrosToolbar availableTags={availableTags} plan={tenant.plan} />

      {miembros.length === 0 ? (
        soloArchivados ? (
          <EmptyState
            icon={<LuArchive />}
            title="Nada en el archivo"
            description="Cuando archives a un miembro queda aquí, con todo su historial. Lo puedes reactivar cuando quieras."
            action={
              <Link href={`/${slug}/miembros`} className={LINK_SECUNDARIO}>
                Ver miembros activos
              </Link>
            }
          />
        ) : isFiltered ? (
          <EmptyState
            icon={<LuSearch />}
            title="Sin resultados"
            description="Ningún miembro coincide con la búsqueda o el filtro."
            action={
              <Link href={`/${slug}/miembros`} className={LINK_SECUNDARIO}>
                Quitar filtros
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<LuUsers />}
            title="Todavía no hay miembros"
            description={
              isOwner
                ? "Da de alta al primero a mano, o sube el CSV que ya llevas y los importamos todos de una vez."
                : "Da de alta al primero y aparece aquí con su membresía y datos de contacto."
            }
            action={
              <>
                <Link href={`/${slug}/miembros/nuevo`} className={LINK_PRIMARIO}>
                  <LuPlus className="h-4 w-4" aria-hidden="true" />
                  Nuevo miembro
                </Link>
                {isOwner && (
                  <Link
                    href={`/${slug}/miembros/importar`}
                    className={LINK_SECUNDARIO}
                  >
                    <LuUpload className="h-4 w-4" aria-hidden="true" />
                    Importar CSV
                  </Link>
                )}
              </>
            }
            hint="Toma 2 minutos"
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
              <p className="font-mono text-etiqueta uppercase text-text-muted">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={hrefPagina(page - 1)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 border border-border px-3 text-sm text-text-primary transition-colors duration-150 hover:border-text-secondary",
                    page <= 1 && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={page <= 1}
                >
                  <LuChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
                </Link>
                <Link
                  href={hrefPagina(page + 1)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 border border-border px-3 text-sm text-text-primary transition-colors duration-150 hover:border-text-secondary",
                    page >= totalPages && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={page >= totalPages}
                >
                  Siguiente <LuChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
