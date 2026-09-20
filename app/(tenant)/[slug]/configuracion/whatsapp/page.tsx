import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo, getWhatsappConfig } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { WhatsappConfigManager } from "@/components/configuracion/WhatsappConfigManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WhatsappConfigPage({ params }: PageProps) {
  await params;
  const g = await requirePanel("config.whatsapp", { sinPermiso: "/configuracion/gym" });
  const tenant = g.ctx;

  if (!g.ok) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="WhatsApp"
        descripcion="Conecta tu número de WhatsApp para activar mensajes automáticos, bot de WhatsApp e inbox."
        beneficios={[
          "Recordatorios de vencimiento y bienvenidas automáticas",
          "Bot de WhatsApp que reserva clases y consulta membresías",
          "Inbox para responder a tus miembros desde STRING GYM",
        ]}
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const config = await getWhatsappConfig(tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">WhatsApp</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Conecta la subcuenta de 360dialog de tu gimnasio para activar los
          mensajes automáticos, el bot y el inbox de WhatsApp.
        </p>
      </div>
      <WhatsappConfigManager config={config} />
    </div>
  );
}
