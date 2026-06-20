import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { MarcaForm } from "@/components/configuracion/MarcaForm";

export default async function MarcaPage() {
  const tenant = await getTenant();
  const gym = await getGymInfo(tenant.id);

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        Personaliza la identidad visual de tu gimnasio. El logo está disponible
        en todos los planes; los colores en Plan Pro o superior.
      </p>

      <div className="pt-4">
        <MarcaForm
          tenantId={tenant.id}
          plan={tenant.plan}
          gymNombre={gym?.nombre ?? ""}
        />
      </div>
    </div>
  );
}
