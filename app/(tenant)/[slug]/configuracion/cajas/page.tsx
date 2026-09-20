import { requirePanel } from "@/lib/authz/pagina";
import { listCajasTodas } from "@/lib/queries/cajas.queries";
import { CajasManager } from "@/components/configuracion/CajasManager";

export default async function CajasPage() {
  const g = await requirePanel("config.caja_crear", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // feature Starter: no ocurre
  const tenant = g.ctx;
  const cajas = await listCajasTodas(tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Cajas</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Cada caja tiene su propio turno y su propio cuadre de efectivo. Úsalo
          si cobras en más de un punto (ej. recepción y una caja de aguas o
          productos aparte).
        </p>
      </div>

      <CajasManager cajas={cajas} />
    </div>
  );
}
