import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortal } from "@/lib/portal/session";
import { getPortalMpDisponible } from "@/lib/queries/portal.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalRenovar } from "@/components/portal/PortalRenovar";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalRenovarPage({ params }: PageProps) {
  const { slug } = await params;
  const { gym } = await requirePortal(slug);

  const mpDisponible = await getPortalMpDisponible(gym.id);
  const planes = mpDisponible
    ? await listPlanes(gym.id, { soloActivos: true }, createAdminClient())
    : [];

  return (
    <div className="min-h-screen">
      <PortalHeader slug={slug} gymNombre={gym.nombre} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <Link
          href={`/portal/${slug}`}
          className="inline-flex h-10 items-center gap-2 self-start text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </Link>

        <h1 className="text-pagina font-semibold text-text-primary">
          Renovar membresía
        </h1>

        {mpDisponible ? (
          <PortalRenovar
            slug={slug}
            planes={planes.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              precio: p.precio,
              dias_duracion: p.dias_duracion,
            }))}
          />
        ) : (
          <div className="flex flex-col items-center gap-5 border border-border bg-surface p-6 text-center">
            <p className="text-sm text-text-secondary">
              Tu gimnasio no tiene pagos en línea. Escríbeles para renovar tu
              membresía.
            </p>
            {gym.telefono && (
              <a
                href={buildWhatsAppUrl(
                  gym.telefono,
                  `Hola, soy miembro de ${gym.nombre} y quiero renovar mi membresía.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 bg-brand-green px-5 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
              >
                <FaWhatsapp className="h-5 w-5" aria-hidden="true" /> Contactar
                por WhatsApp
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
