import { getTenant } from "@/lib/tenant";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { notFound } from "next/navigation";
import { ConfigTabs } from "@/components/configuracion/ConfigTabs";
import { GymConfigManager } from "@/components/configuracion/GymConfigManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GymConfigPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const gym = await getGymFull(tenant.id);
  if (!gym) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Configuración
        </h2>
      </div>

      <ConfigTabs slug={slug} />

      <div>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Datos del gimnasio
        </h3>
        <GymConfigManager gym={gym} />
      </div>
    </div>
  );
}
