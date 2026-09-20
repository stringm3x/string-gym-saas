import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import {
  getDestinatariosByAudiencia,
  getCampanas,
} from "@/lib/queries/campanas.queries";
import { AUDIENCIAS } from "@/lib/validations/campanas.schema";
import { CampanasManager } from "@/components/campanas/CampanasManager";
import type { AudienciaData } from "@/components/campanas/CampanaWizard";

export default async function CampanasPage() {
  // Misma política que enviarCampanaAction (campanas + ver_dashboard_ingresos).
  const g = await requirePanel("campanas.enviar", { sinPermiso: "/checkins" });
  const tenant = g.ctx;

  if (!g.ok) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Campañas / Mensajes masivos"
        descripcion="Envía mensajes a segmentos de tus miembros y prospectos por WhatsApp, con conteo en vivo y variables personalizadas."
        beneficios={[
          "Audiencias por vencimiento, actividad o prospectos",
          "Mensaje con variables ({nombre}, {fecha_vencimiento})",
          "Vista previa antes de enviar",
          "Historial de campañas enviadas",
        ]}
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const [audienciasResult, campanas] = await Promise.all([
    Promise.all(
      AUDIENCIAS.map(async (a): Promise<AudienciaData> => {
        const r = await getDestinatariosByAudiencia(tenant.id, a.value);
        return {
          value: a.value,
          label: a.label,
          descripcion: a.descripcion,
          total: r.destinatarios.length,
          sinTelefono: r.sinTelefono,
          destinatarios: r.destinatarios,
        };
      })
    ),
    getCampanas(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-pagina text-text-primary font-semibold">
          Campañas
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Mensajes masivos por WhatsApp a segmentos de miembros y prospectos.
        </p>
      </div>

      <CampanasManager audiencias={audienciasResult} campanas={campanas} />
    </div>
  );
}
