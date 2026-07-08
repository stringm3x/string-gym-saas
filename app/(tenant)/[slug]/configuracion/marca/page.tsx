import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getGooglePlaceId } from "@/lib/queries/opiniones.queries";
import { MarcaForm } from "@/components/configuracion/MarcaForm";
import { GooglePlaceIdForm } from "@/components/configuracion/GooglePlaceIdForm";

export default async function MarcaPage() {
  const tenant = await getTenant();
  const canOpiniones = hasFeature(tenant.plan, "opiniones");
  const [gym, googlePlaceId] = await Promise.all([
    getGymInfo(tenant.id),
    canOpiniones ? getGooglePlaceId(tenant.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Personaliza la identidad visual de tu gimnasio. El logo está disponible
        en todos los planes; los colores en Plan Pro o superior.
      </p>

      <div className="pt-2">
        <MarcaForm
          tenantId={tenant.id}
          plan={tenant.plan}
          gymNombre={gym?.nombre ?? ""}
        />
      </div>

      {canOpiniones && <GooglePlaceIdForm inicial={googlePlaceId ?? ""} />}
    </div>
  );
}
