import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getGooglePlaceId } from "@/lib/queries/opiniones.queries";
import { MarcaForm } from "@/components/configuracion/MarcaForm";
import { GooglePlaceIdForm } from "@/components/configuracion/GooglePlaceIdForm";

export default async function MarcaPage() {
  const g = await requirePanel("config.marca_color", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // color_gimnasio es Starter: no ocurre
  const tenant = g.ctx;
  const canOpiniones = tenant.has("opiniones");
  const [gym, googlePlaceId] = await Promise.all([
    getGymInfo(tenant.id),
    canOpiniones ? getGooglePlaceId(tenant.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Marca</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Personaliza la identidad visual de tu gimnasio. Logo y color de
          acento están disponibles en todos los planes.
        </p>
      </div>

      <MarcaForm tenantId={tenant.id} gymNombre={gym?.nombre ?? ""} />

      {canOpiniones && (
        <div className="border-t border-border pt-6">
          <GooglePlaceIdForm inicial={googlePlaceId ?? ""} />
        </div>
      )}
    </div>
  );
}
