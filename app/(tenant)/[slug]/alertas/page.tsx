import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AlertasList } from "@/components/alertas/AlertasList";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AlertasPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasPermission(tenant.role, "ver_alertas")) {
    redirect(`/${slug}/checkins`);
  }

  if (!hasFeature(tenant.plan, "alertas_dueno")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Centro de alertas"
        descripcion="Detecta automáticamente lo que requiere tu atención cada día."
        beneficios={[
          "Vencimientos de hoy y próximos",
          "Prospectos sin contactar y stock bajo",
          "Miembros sin actividad reciente",
        ]}
        planRequerido="escala"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

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
