import Link from "next/link";
import { redirect } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listPlanes } from "@/lib/queries/planes.queries";
import { ImportarMiembrosWizard } from "@/components/miembros/import/ImportarMiembrosWizard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ImportarMiembrosPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  // Solo el dueño puede importar (operación crítica).
  if (tenant.role !== "owner") {
    redirect(`/${slug}/miembros`);
  }

  const planes = await listPlanes(tenant.id, { soloActivos: true });

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

        <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-text-primary">
          Importar miembros
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Migra tu base de miembros desde un archivo CSV en tres pasos.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <ImportarMiembrosWizard
          slug={slug}
          planesNombres={planes.map((p) => p.nombre)}
        />
      </div>
    </div>
  );
}
