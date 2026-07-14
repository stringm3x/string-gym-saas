import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo, getWhatsappConfig } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { WhatsappConfigManager } from "@/components/configuracion/WhatsappConfigManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WhatsappConfigPage({ params }: PageProps) {
  await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "whatsapp_automatico")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="WhatsApp"
        descripcion="Conecta tu número de WhatsApp para activar mensajes automáticos, bot con IA e inbox unificado."
        beneficios={[
          "Recordatorios de vencimiento y bienvenidas automáticas",
          "Bot con IA que reserva clases y consulta membresías",
          "Inbox para responder a tus miembros desde STRING GYM",
        ]}
        planRequerido="escala"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const config = await getWhatsappConfig(tenant.id);

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        WhatsApp
      </h3>
      <WhatsappConfigManager config={config} />
    </div>
  );
}
