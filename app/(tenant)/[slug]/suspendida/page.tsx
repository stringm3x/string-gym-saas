import { FaWhatsapp } from "react-icons/fa";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";
import { AuthShell, AuthCardHeader } from "@/components/layout/AuthShell";
import { cerrarSesionAction } from "./actions";

/**
 * Cuenta en pausa (prueba vencida o suspensión). El gimnasio no está
 * trabajando: mismo marco que el acceso, con el cartel diciendo lo que pasa.
 */
export default async function SuspendidaPage() {
  const tenant = await getTenant();
  const gym = await getGymInfo(tenant.id);
  const nombre = gym?.nombre ?? "tu gimnasio";

  const wa = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Hola Carlos, soy de ${nombre} y quiero reactivar mi cuenta de STRING GYM.`
  )}`;

  return (
    <AuthShell
      headline={
        <>
          TU CUENTA
          <br />
          ESTÁ EN{" "}
          <span className="bg-brand-green px-2.5 text-on-brand">PAUSA</span>.
        </>
      }
      lead="Tus socios, pagos y check-ins siguen guardados. Nada se borra: en cuanto se reactive la cuenta, todo está donde lo dejaste."
    >
      <AuthCardHeader
        kicker="Cuenta en pausa"
        titulo="Reactivar el acceso"
        texto={`El acceso a ${nombre} está pausado. Escríbele a Carlos por WhatsApp y lo resuelven en el momento.`}
      />

      <div className="flex flex-col gap-3">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center gap-2 bg-brand-green px-6 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
        >
          <FaWhatsapp className="h-5 w-5" aria-hidden="true" />
          Contactar por WhatsApp
        </a>

        <form action={cerrarSesionAction}>
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center border border-border px-6 text-base text-text-primary transition-colors hover:border-text-secondary"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
