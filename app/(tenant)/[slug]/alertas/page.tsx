import { getTenant } from "@/lib/tenant";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { AlertasList } from "@/components/alertas/AlertasList";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AlertasPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const alertas = await getAlertas(tenant.id, slug);
  const total = alertas.reduce((sum, a) => sum + (a.count ?? 1), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Centro de alertas
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {alertas.length === 0
            ? "Sin alertas activas"
            : `${total} punto${total !== 1 ? "s" : ""} que requieren atención`}
        </p>
      </div>

      <AlertasList alertas={alertas} />
    </div>
  );
}
