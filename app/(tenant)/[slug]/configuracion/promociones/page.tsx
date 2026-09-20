import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listPromociones } from "@/lib/queries/promociones.queries";
import { PromocionesManager } from "@/components/configuracion/PromocionesManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PromocionesPage({ params }: PageProps) {
  const { slug } = await params;
  // Misma política que createPromocionAction: promociones (Pro) + configurar_planes_promociones.
  const g = await requirePanel("config.promocion_crear", { sinPermiso: "/configuracion/gym" });

  if (!g.ok) {
    const gym = await getGymInfo(g.ctx.id);
    return (
      <UpgradePage
        titulo="Promociones"
        descripcion="Crea promociones de membresía y producto con precios y vigencia."
        beneficios={[
          "Promos de membresía con duración personalizada",
          "Promos de producto para tu punto de venta",
          "Disponibles al cobrar en caja",
        ]}
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const promociones = await listPromociones(g.ctx.id);

  return <PromocionesManager promociones={promociones} />;
}
