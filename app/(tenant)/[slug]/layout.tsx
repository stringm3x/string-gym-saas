import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countMiembrosVencenHoy } from "@/lib/queries/miembros.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
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

  const [gym, miembrosVencenHoy, stockBajo] = await Promise.all([
    getGymInfo(tenant.id),
    countMiembrosVencenHoy(tenant.id),
    countStockBajo(tenant.id),
  ]);

  if (!gym) {
    redirect("/login");
  }

  const badges = {
    miembros: miembrosVencenHoy,
    inventario: stockBajo,
    prospectos: undefined,
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
