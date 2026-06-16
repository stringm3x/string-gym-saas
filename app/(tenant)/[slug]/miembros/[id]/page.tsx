import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { listCheckinsByMiembro } from "@/lib/queries/checkins.queries";
import { listPagosByMiembro } from "@/lib/queries/pagos.queries";
import { listTags, getTagsForMiembro } from "@/lib/queries/tags.queries";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { MiembroStatusBadge } from "@/components/miembros/MiembroStatusBadge";
import { ManualCheckinButton } from "@/components/checkins/ManualCheckinButton";
import { CheckinsHistory } from "@/components/checkins/CheckinsHistory";
import { PagosHistory } from "@/components/caja/PagosHistory";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function MiembroDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getTenant();

  const [miembro, checkins, pagos, miembroTags, availableTags] =
    await Promise.all([
      getMiembro(tenant.id, id),
      listCheckinsByMiembro(tenant.id, id, 20),
      listPagosByMiembro(tenant.id, id, 30),
      getTagsForMiembro(tenant.id, id),
      listTags(tenant.id),
    ]);

  if (!miembro) {
    notFound();
  }

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

          <ManualCheckinButton
            miembroId={miembro.id}
            miembroNombre={miembro.nombre}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <MiembroForm
          mode="edit"
          slug={slug}
          miembro={miembroConTags}
          availableTags={availableTags}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Historial de pagos
          </h3>
          <PagosHistory pagos={pagos} />
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
