import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { hasFeature } from "@/lib/features";
import { PromocionesManager } from "@/components/configuracion/PromocionesManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PromocionesPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "promociones")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Promociones"
        descripcion="Crea promociones de membresía y producto con precios y vigencia."
        beneficios={[
          "Promos de membresía con duración personalizada",
          "Promos de producto para tu punto de venta",
          "Disponibles al cobrar en caja",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const promociones = await listPromociones(tenant.id);

  return <PromocionesManager promociones={promociones} />;
}
