import { LuLock } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";
import { cerrarSesionAction } from "./actions";

export default async function SuspendidaPage() {
  const tenant = await getTenant();
  const gym = await getGymInfo(tenant.id);
  const nombre = gym?.nombre ?? "tu gimnasio";

  const wa = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Hola Carlos, soy de ${nombre} y quiero reactivar mi cuenta de STRING GYM.`
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
          <LuLock className="h-6 w-6" />
        </span>

        <h1 className="mt-5 text-xl font-semibold text-text-primary">
          Tu período de prueba ha terminado
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          El acceso a <span className="font-medium text-text-primary">{nombre}</span>{" "}
          está pausado. Contacta a Carlos para reactivar tu cuenta y seguir
          usando STRING GYM.
        </p>

        <div className="mt-7 space-y-3">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <FaWhatsapp className="h-4 w-4" />
            Contactar por WhatsApp
          </a>

          <form action={cerrarSesionAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
