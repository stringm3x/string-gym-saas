import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import { getPortalGym } from "@/lib/queries/portal.queries";
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
        <div className="max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-secondary">
            El portal del miembro no está disponible para este gimnasio.
          </p>
        </div>
      </div>
    );
  }

  // Si ya tiene sesión de ESTE gym, al dashboard.
  const session = await getPortalSession();
  if (session && session.tenantId === gym.id) {
    redirect(`/portal/${slug}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PortalLoginForm slug={slug} gymNombre={gym.nombre} />
    </div>
  );
}
