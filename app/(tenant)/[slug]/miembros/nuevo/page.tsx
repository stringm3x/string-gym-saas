import Link from "next/link";
import { LuArrowLeft, LuArrowRightLeft } from "react-icons/lu";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { getTenant } from "@/lib/tenant";
import { getProspecto } from "@/lib/queries/prospectos.queries";
import { listTags } from "@/lib/queries/tags.queries";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ prospecto_id?: string }>;
}

export default async function NuevoMiembroPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { prospecto_id } = await searchParams;

  const tenant = await getTenant();
  const [prospecto, availableTags] = await Promise.all([
    prospecto_id ? getProspecto(tenant.id, prospecto_id) : Promise.resolve(null),
    listTags(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Volver a miembros
        </Link>

        <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-text-primary">
          Nuevo miembro
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Registra los datos básicos. Podrás registrar pagos y check-ins desde
          su ficha.
        </p>
      </div>

      {prospecto && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LuArrowRightLeft className="h-4 w-4 shrink-0 text-brand-green" />
            <div>
              <p className="text-sm font-medium text-brand-green">
                Convirtiendo prospecto: {prospecto.nombre}
              </p>
              <p className="text-xs text-brand-green/70">
                Los datos han sido prellenados. Completa la fecha de inscripción y plan.
              </p>
            </div>
          </div>
          <Link
            href={`/${slug}/prospectos`}
            className="shrink-0 text-xs font-medium text-brand-green/70 underline underline-offset-2 hover:text-brand-green"
          >
            Cancelar conversión
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
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
              : undefined
          }
          prospectoId={prospecto?.id}
          availableTags={availableTags}
        />
      </div>
    </div>
  );
}
