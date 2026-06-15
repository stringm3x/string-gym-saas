import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { SidebarWithActiveSection } from "@/components/layout/SidebarWithActiveSection";
import { Header } from "@/components/layout/Header";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenant();

  // Seguridad adicional: el slug de la URL debe coincidir con el
  // tenant resuelto por el middleware (defensa en profundidad).
  if (tenant.slug !== slug) {
    redirect("/login");
  }

  const gym = await getGymInfo(tenant.id);

  if (!gym) {
    redirect("/login");
  }

  // TODO (Fase 2/5/6): reemplazar con queries reales:
  // - badges.miembros  -> lib/queries/miembros.queries.ts (vencen hoy)
  // - badges.inventario -> lib/queries/inventario.queries.ts (stock <= stock_minimo)
  // - badges.prospectos -> lib/queries/prospectos.queries.ts (estado = 'nuevo')
  const badges = {
    miembros: undefined,
    inventario: undefined,
    prospectos: undefined,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <SidebarWithActiveSection
        slug={slug}
        plan={tenant.plan}
        badges={badges}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header gymNombre={gym.nombre} plan={tenant.plan} />

        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
