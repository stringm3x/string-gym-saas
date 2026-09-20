import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listTagsConConteo } from "@/lib/queries/tags.queries";
import { TagsManager } from "@/components/configuracion/TagsManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagsPage({ params }: PageProps) {
  const { slug } = await params;
  // Misma política que createTagAction: tags (Pro) + configurar_planes_promociones.
  const g = await requirePanel("config.tag_crear", { sinPermiso: "/configuracion/gym" });

  if (!g.ok) {
    const gym = await getGymInfo(g.ctx.id);
    return (
      <UpgradePage
        titulo="Tags"
        descripcion="Organiza y segmenta a tus miembros y prospectos con etiquetas."
        beneficios={[
          "Etiqueta miembros y prospectos por color",
          "Filtra listados por tag",
          "Asignación masiva de tags en bloque",
        ]}
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const tags = await listTagsConConteo(g.ctx.id);

  return <TagsManager tags={tags} />;
}
