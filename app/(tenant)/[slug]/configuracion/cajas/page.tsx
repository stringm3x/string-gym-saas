import { getTenant } from "@/lib/tenant";
import { listCajasTodas } from "@/lib/queries/cajas.queries";
import { CajasManager } from "@/components/configuracion/CajasManager";

export default async function CajasPage() {
  const tenant = await getTenant();
  const cajas = await listCajasTodas(tenant.id);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        Cada caja tiene su propio turno y su propio cuadre de efectivo — úsalo
        si cobras en más de un punto (ej. Recepción y una caja de aguas o
        productos aparte).
      </p>

      <div className="pt-4">
        <CajasManager cajas={cajas} />
      </div>
    </div>
  );
}
