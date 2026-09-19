import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import { getPortalGym } from "@/lib/queries/portal.queries";
import { gymPuedeWhatsapp } from "@/lib/whatsapp/emit";
import { getPortalSession } from "@/lib/portal/session";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalLoginPage({ params }: PageProps) {
  const { slug } = await params;
  const gym = await getPortalGym(slug);

  if (!gym || !hasFeature(gym.plan, "portal_miembro")) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            El portal del socio no está disponible para este gimnasio.
          </p>
        </div>
      </div>
    );
  }

  // Si ya tiene sesión de ESTE gym, al inicio del portal.
  const session = await getPortalSession();
  if (session && session.tenantId === gym.id) {
    redirect(`/portal/${slug}`);
  }

  const puedeWhatsapp = await gymPuedeWhatsapp(gym.id);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <PortalLoginForm
        slug={slug}
        gymNombre={gym.nombre}
        puedeWhatsapp={puedeWhatsapp}
      />
      <p className="font-mono text-etiqueta uppercase text-text-muted">
        STRING GYM
      </p>
    </div>
  );
}
