import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { listCheckinsByMiembro } from "@/lib/queries/checkins.queries";
import { listPagosByMiembro } from "@/lib/queries/pagos.queries";
import { listTags, getTagsForMiembro } from "@/lib/queries/tags.queries";
import { listNotas } from "@/lib/queries/notas.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { NotasTimeline } from "@/components/miembros/NotasTimeline";
import { NotasLegacy } from "@/components/miembros/NotasLegacy";
import { AccionesRapidas } from "@/components/ui/AccionesRapidas";
import { MiembroStatusBadge } from "@/components/miembros/MiembroStatusBadge";
import { MiembroArchivarButton } from "@/components/miembros/MiembroArchivarButton";
import { MiembroArchivadoBanner } from "@/components/miembros/MiembroArchivadoBanner";
import { ManualCheckinButton } from "@/components/checkins/ManualCheckinButton";
import { CheckinsHistory } from "@/components/checkins/CheckinsHistory";
import { PagosHistory } from "@/components/caja/PagosHistory";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function MiembroDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getTenant();

  const [miembro, checkins, pagos, miembroTags, availableTags, notas, plantillas] =
    await Promise.all([
      getMiembro(tenant.id, id),
      listCheckinsByMiembro(tenant.id, id, 20),
      listPagosByMiembro(tenant.id, id, 30),
      getTagsForMiembro(tenant.id, id),
      listTags(tenant.id),
      listNotas(tenant.id, "miembro", id),
      listPlantillas(tenant.id, { soloActivas: true }),
    ]);

  if (!miembro) {
    notFound();
  }

  const canTags = hasFeature(tenant.plan, "tags");
  const canTimeline = hasFeature(tenant.plan, "timeline_notas");
  const canPlantillas = hasFeature(tenant.plan, "plantillas_mensaje");
  const canArchivar = hasPermission(tenant.role, "eliminar_archivar_miembros");

  const miembroConTags = { ...miembro, tags: miembroTags };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Volver a miembros
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
              {miembro.nombre}
            </h2>
            <MiembroStatusBadge fechaVencimiento={miembro.fecha_vencimiento} />
          </div>

          <div className="flex items-center gap-2">
            <AccionesRapidas
              nombre={miembro.nombre}
              telefono={miembro.telefono}
              email={miembro.email}
              fechaVencimiento={miembro.fecha_vencimiento}
              entidadTipo="miembro"
              entidadId={miembro.id}
              plantillas={canPlantillas ? plantillas : []}
            />
            <ManualCheckinButton
              miembroId={miembro.id}
              miembroNombre={miembro.nombre}
              disabled={miembro.archivado}
              disabledTitle="Restaura para realizar acciones"
            />
            {!miembro.archivado && canArchivar && (
              <MiembroArchivarButton
                miembroId={miembro.id}
                miembroNombre={miembro.nombre}
              />
            )}
          </div>
        </div>
      </div>

      {miembro.archivado && (
        <MiembroArchivadoBanner
          miembroId={miembro.id}
          archivadoAt={miembro.archivado_at}
          canRestore={canArchivar}
        />
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <MiembroForm
          mode="edit"
          slug={slug}
          miembro={miembroConTags}
          availableTags={canTags ? availableTags : []}
          disabled={miembro.archivado}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        {canTimeline ? (
          <NotasTimeline
            entidadTipo="miembro"
            entidadId={id}
            notas={notas}
            legacyNotas={miembro.notas}
          />
        ) : (
          <NotasLegacy miembroId={miembro.id} notas={miembro.notas} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Historial de pagos
          </h3>
          <PagosHistory pagos={pagos} slug={slug} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Historial de check-ins
          </h3>
          <CheckinsHistory checkins={checkins} />
        </div>
      </div>
    </div>
  );
}
