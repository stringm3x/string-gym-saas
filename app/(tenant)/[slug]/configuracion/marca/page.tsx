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
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Marca</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Personaliza la identidad visual de tu gimnasio. El logo está
          disponible en todos los planes; los colores en Plan Pro o superior.
        </p>
      </div>

      <MarcaForm
        tenantId={tenant.id}
        plan={tenant.plan}
        gymNombre={gym?.nombre ?? ""}
      />

      {canOpiniones && (
        <div className="border-t border-border pt-6">
          <GooglePlaceIdForm inicial={googlePlaceId ?? ""} />
        </div>
      )}
    </div>
  );
}
