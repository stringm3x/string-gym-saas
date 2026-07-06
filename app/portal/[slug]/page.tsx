import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import { getPortalGym, getMiembroPortal } from "@/lib/queries/portal.queries";
import { getPortalSession } from "@/lib/portal/session";
import { cerrarSesionPortalAction } from "./actions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalHomePage({ params }: PageProps) {
  const { slug } = await params;
  const gym = await getPortalGym(slug);
  if (!gym || !hasFeature(gym.plan, "portal_miembro")) {
    redirect(`/portal/${slug}/login`);
  }

  const session = await getPortalSession();
  if (!session || session.tenantId !== gym.id) {
    redirect(`/portal/${slug}/login`);
  }

  const miembro = await getMiembroPortal(session.tenantId, session.miembroId);
  if (!miembro) {
    redirect(`/portal/${slug}/login`);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const vigente = !!miembro.fecha_vencimiento && miembro.fecha_vencimiento >= hoy;

  const cerrar = cerrarSesionPortalAction.bind(null, slug);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-display text-lg uppercase tracking-wide text-text-primary">
          {gym.nombre}
        </span>
        <form action={cerrar}>
          <button
            type="submit"
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">Hola,</p>
        <h1 className="text-xl font-semibold text-text-primary">
          {miembro.nombre}
        </h1>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              vigente
                ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {vigente ? "Membresía activa" : "Membresía vencida"}
          </span>
          {miembro.fecha_vencimiento && (
            <span className="text-xs text-text-secondary">
              Vence el{" "}
              {new Date(
                miembro.fecha_vencimiento + "T00:00:00"
              ).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Próximamente: tus clases, recibos y renovación.
      </p>
    </div>
  );
}
