import Link from "next/link";
import { redirect } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { hasFeature } from "@/lib/features";
import { requirePortal } from "@/lib/portal/session";
import {
  getClasesDisponiblesPortal,
  getProximasReservasPortal,
} from "@/lib/queries/portal.queries";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalClases, type SesionRow } from "@/components/portal/PortalClases";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalClasesPage({ params }: PageProps) {
  const { slug } = await params;
  const { gym, session } = await requirePortal(slug);
  if (!hasFeature(gym.plan, "clases")) redirect(`/portal/${slug}`);

  const [sesiones, misReservas] = await Promise.all([
    getClasesDisponiblesPortal(gym.id),
    getProximasReservasPortal(gym.id, session.miembroId),
  ]);

  const rows: SesionRow[] = sesiones.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    hora_inicio: s.hora_inicio,
    cupo_maximo: s.cupo_maximo,
    cupo_disponible: s.cupo_disponible,
    clase_nombre: s.clase?.nombre ?? "Clase",
  }));

  return (
    <div className="min-h-screen">
      <PortalHeader slug={slug} gymNombre={gym.nombre} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <Link
          href={`/portal/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <PortalClases slug={slug} sesiones={rows} misReservas={misReservas} />
      </main>
    </div>
  );
}
