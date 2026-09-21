import Link from "next/link";
import { LuArrowLeft, LuArrowRightLeft } from "react-icons/lu";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { requirePanel } from "@/lib/authz/pagina";
import { getProspecto } from "@/lib/queries/prospectos.queries";
import { listTags } from "@/lib/queries/tags.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    prospecto_id?: string;
    nombre?: string;
    telefono?: string;
  }>;
}

export default async function NuevoMiembroPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { prospecto_id, nombre, telefono } = await searchParams;

  const g = await requirePanel("miembros.crear", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // miembros es Starter: no ocurre
  const tenant = g.ctx;
  const [prospecto, availableTags, planes, promocionesMembresia] =
    await Promise.all([
      prospecto_id
        ? getProspecto(tenant.id, prospecto_id)
        : Promise.resolve(null),
      listTags(tenant.id),
      listPlanes(tenant.id, { soloActivos: true }),
      listPromociones(tenant.id, {
        soloActivasVigentes: true,
        tipo: "membresia",
      }),
    ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex h-9 items-center gap-1.5 self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
          Miembros
        </Link>
        <h2 className="text-pagina font-semibold text-text-primary">
          Nuevo miembro
        </h2>
        <p className="text-sm text-text-secondary">
          Registra los datos básicos. Los pagos y check-ins se registran
          desde su ficha.
        </p>
      </div>

      {prospecto && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-3">
            <LuArrowRightLeft
              className="h-4 w-4 shrink-0 text-text-muted"
              aria-hidden="true"
            />
            <div>
              <p className="text-[15px] leading-5 text-text-primary">
                Convirtiendo prospecto: {prospecto.nombre}
              </p>
              <p className="text-sm text-text-muted">
                Datos prellenados. Completa la fecha de inscripción y el plan.
              </p>
            </div>
          </div>
          <Link
            href={`/${slug}/prospectos`}
            className="inline-flex h-9 shrink-0 items-center text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            Cancelar conversión
          </Link>
        </div>
      )}

      <div className="card-surface p-6">
        <MiembroForm
          mode="create"
          slug={slug}
          defaultValues={
            prospecto
              ? {
                  nombre: prospecto.nombre,
                  telefono: prospecto.telefono,
                  email: prospecto.email ?? "",
                }
              : nombre || telefono
                ? { nombre, telefono }
                : undefined
          }
          prospectoId={prospecto?.id}
          availableTags={hasFeature(tenant.plan, "tags") ? availableTags : []}
          planes={planes}
          promocionesMembresia={promocionesMembresia}
        />
      </div>
    </div>
  );
}
