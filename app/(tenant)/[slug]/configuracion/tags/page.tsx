import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listTagsConConteo } from "@/lib/queries/tags.queries";
import { hasFeature } from "@/lib/features";
import { TagsManager } from "@/components/configuracion/TagsManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "tags")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Tags"
        descripcion="Organiza y segmenta a tus miembros y prospectos con etiquetas."
        beneficios={[
          "Etiqueta miembros y prospectos por color",
          "Filtra listados por tag",
          "Asignación masiva de tags en bloque",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const tags = await listTagsConConteo(tenant.id);

  return <TagsManager tags={tags} />;
}
