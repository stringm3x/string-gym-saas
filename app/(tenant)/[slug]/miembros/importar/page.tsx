import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { requirePanel } from "@/lib/authz/pagina";
import { listPlanes } from "@/lib/queries/planes.queries";
import { ImportarMiembrosWizard } from "@/components/miembros/import/ImportarMiembrosWizard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ImportarMiembrosPage({ params }: PageProps) {
  const { slug } = await params;
  // Misma política que importarMiembrosAction (importacion_csv + configurar_general):
  // owner y gerente, no solo el dueño.
  const g = await requirePanel("miembros.importar", { sinPermiso: "/miembros" });
  if (!g.ok) return null; // importacion_csv es Starter: no ocurre
  const tenant = g.ctx;

  const planes = await listPlanes(tenant.id, { soloActivos: true });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex h-9 items-center gap-1.5 self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
          Miembros
        </Link>
        <h2 className="text-pagina font-semibold text-text-primary">
          Importar miembros
        </h2>
        <p className="text-sm text-text-secondary">
          Trae tu base de miembros desde un archivo CSV en tres pasos.
        </p>
      </div>

      <div className="card-surface p-6">
        <ImportarMiembrosWizard
          slug={slug}
          planesNombres={planes.map((p) => p.nombre)}
        />
      </div>
    </div>
  );
}
