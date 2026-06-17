import { getTenant } from "@/lib/tenant";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { notFound } from "next/navigation";
import { GymConfigManager } from "@/components/configuracion/GymConfigManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GymConfigPage({ params }: PageProps) {
  await params;
  const tenant = await getTenant();

  const gym = await getGymFull(tenant.id);
  if (!gym) notFound();

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        Datos del gimnasio
      </h3>
      <GymConfigManager gym={gym} />
    </div>
  );
}
