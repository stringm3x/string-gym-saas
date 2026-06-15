import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countMiembrosVencenHoy } from "@/lib/queries/miembros.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
import { countProspectosNuevos } from "@/lib/queries/prospectos.queries";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { hasFeature } from "@/lib/features";
import { SidebarWithActiveSection } from "@/components/layout/SidebarWithActiveSection";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (tenant.slug !== slug) {
    redirect("/login");
  }

  const tieneAlertas = hasFeature(tenant.plan, "alertas_dueno");

  const [gym, miembrosVencenHoy, stockBajo, prospectosNuevos, alertas] =
    await Promise.all([
      getGymInfo(tenant.id),
      countMiembrosVencenHoy(tenant.id),
      countStockBajo(tenant.id),
      countProspectosNuevos(tenant.id),
      tieneAlertas ? getAlertas(tenant.id, slug) : Promise.resolve([]),
    ]);

  if (!gym) {
    redirect("/login");
  }

  const alertasBadge = tieneAlertas
    ? alertas.reduce((sum, a) => sum + (a.count ?? 1), 0)
    : undefined;

  const badges = {
    miembros: miembrosVencenHoy,
    inventario: stockBajo,
    prospectos: prospectosNuevos,
    alertas: alertasBadge,
  };

  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
