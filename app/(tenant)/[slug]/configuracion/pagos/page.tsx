import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getMpStatus } from "@/lib/queries/mercadopago.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { PagosMpPanel } from "@/components/configuracion/PagosMpPanel";

export default async function PagosConfigPage() {
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "mercadopago")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Pagos con MercadoPago"
        descripcion="Cobra con tarjeta, OXXO y SPEI desde el sistema. El gym usa su propia cuenta de MercadoPago."
        beneficios={[
          "Cobro con tarjeta, OXXO y transferencia (SPEI)",
          "Links de pago para enviar por WhatsApp",
          "Confirmación automática por webhook",
          "El dinero llega directo a tu cuenta MercadoPago",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const status = await getMpStatus(tenant.id);

  return (
    <div className="space-y-2 pt-2">
      <p className="text-sm text-text-secondary">
        Conecta MercadoPago para cobrar con tarjeta, OXXO y SPEI desde la Caja.
      </p>
      <div className="pt-2">
        <PagosMpPanel status={status} />
      </div>
    </div>
  );
}
