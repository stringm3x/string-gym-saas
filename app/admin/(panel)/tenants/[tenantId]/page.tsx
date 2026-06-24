import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { notFound } from "next/navigation";

/**
 * Detalle de tenant — placeholder del Bloque 3.
 * Las acciones administrativas, métricas, pagos manuales y notas se
 * construyen en el Bloque 4. Aquí solo se confirma navegación + 404.
 */
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const current = await getCurrentAdmin();
  if (!current) notFound();

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id, nombre, slug, plan, estado")
    .eq("id", tenantId)
    .maybeSingle();

  if (!gym) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/tenants"
        className="text-xs text-text-secondary hover:text-text-primary"
      >
        ← Tenants
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          {gym.nombre}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">/{gym.slug}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">
          El detalle completo (métricas, acciones administrativas, pagos
          manuales, notas internas y audit log del tenant) se construye en
          el Bloque 4.
        </p>
      </div>
    </div>
  );
}
