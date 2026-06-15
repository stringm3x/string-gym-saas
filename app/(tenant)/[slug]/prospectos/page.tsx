import { getTenant } from "@/lib/tenant";
import { listProspectos } from "@/lib/queries/prospectos.queries";
import { ProspectosKanban } from "@/components/prospectos/ProspectosKanban";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProspectosPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const prospectos = await listProspectos(tenant.id);

  return (
    <div className="flex h-full flex-col space-y-4">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Prospectos
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {prospectos.length === 0
            ? "Sin prospectos aún"
            : `${prospectos.length} prospecto${prospectos.length !== 1 ? "s" : ""} en total`}
        </p>
      </div>

      <ProspectosKanban prospectos={prospectos} slug={slug} />
    </div>
  );
}
