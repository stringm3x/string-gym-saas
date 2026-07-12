import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import {
  listConversaciones,
  getMensajes,
  getMiembroResumenInbox,
} from "@/lib/queries/inbox.queries";
import { InboxClient } from "@/components/inbox/InboxClient";

export default async function WhatsappInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "whatsapp_automatico")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="WhatsApp / Inbox"
        descripcion="Contesta los WhatsApp de tus miembros desde STRING GYM. El bot responde solo y tú tomas el control cuando quieras."
        beneficios={[
          "Bandeja unificada de conversaciones por gym",
          "Bot con IA que reserva clases y consulta membresías",
          "Pausa el bot y responde manual en cualquier conversación",
          "Historial completo: recordatorios, pagos y bienvenidas",
        ]}
        planRequerido="escala"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const { c } = await searchParams;
  const conversaciones = await listConversaciones(tenant.id);
  const activa = c ? conversaciones.find((x) => x.id === c) ?? null : null;

  const mensajes = activa ? await getMensajes(tenant.id, activa.id) : [];
  const miembro =
    activa?.miembro_id != null
      ? await getMiembroResumenInbox(tenant.id, activa.miembro_id)
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          WhatsApp
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Conversaciones con tus miembros. El bot responde solo; pausa y toma el
          control cuando quieras.
        </p>
      </div>

      <InboxClient
        slug={tenant.slug}
        conversaciones={conversaciones}
        activeId={activa?.id ?? null}
        activa={activa}
        mensajes={mensajes}
        miembro={miembro}
      />
    </div>
  );
}
