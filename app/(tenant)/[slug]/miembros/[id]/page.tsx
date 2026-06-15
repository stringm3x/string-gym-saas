import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { MiembroStatusBadge } from "@/components/miembros/MiembroStatusBadge";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function MiembroDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getTenant();

  const miembro = await getMiembro(tenant.id, id);

  if (!miembro) {
    notFound();
  }

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

        <div className="mt-2 flex items-center gap-3">
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            {miembro.nombre}
          </h2>
          <MiembroStatusBadge fechaVencimiento={miembro.fecha_vencimiento} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <MiembroForm mode="edit" slug={slug} miembro={miembro} />
      </div>
    </div>
  );
}
