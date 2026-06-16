import { getTenant } from "@/lib/tenant";
import { listTagsConConteo } from "@/lib/queries/tags.queries";
import { TagsManager } from "@/components/configuracion/TagsManager";

export default async function TagsPage() {
  const tenant = await getTenant();
  const tags = await listTagsConConteo(tenant.id);

  return <TagsManager tags={tags} />;
}
