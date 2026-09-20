import { requirePanel } from "@/lib/authz/pagina";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { notFound } from "next/navigation";
import { GymConfigManager } from "@/components/configuracion/GymConfigManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GymConfigPage({ params }: PageProps) {
  await params;
  const g = await requirePanel("config.gym", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // feature Starter: no ocurre
  const tenant = g.ctx;

  const gym = await getGymFull(tenant.id);
  if (!gym) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">
          Datos del gimnasio
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Nombre, contacto y reglas de acceso. Aparecen en recibos y check-in.
        </p>
      </div>
      <GymConfigManager gym={gym} />
    </div>
  );
}
