import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countMiembrosVencenHoy } from "@/lib/queries/miembros.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
import { countProspectosNuevos } from "@/lib/queries/prospectos.queries";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { listGymAddons } from "@/lib/queries/addons.queries";
import { getGymMarca } from "@/lib/queries/marca.queries";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import { hasFeature } from "@/lib/features";
import { SidebarWithActiveSection } from "@/components/layout/SidebarWithActiveSection";
import { Header } from "@/components/layout/Header";
import { TerminosGate } from "@/components/layout/TerminosGate";
import { ToastProvider } from "@/components/ui/Toast";
import { AddonsProvider } from "@/lib/contexts/AddonsContext";
import { StaffProvider } from "@/lib/contexts/StaffContext";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // La página /suspendida se renderiza a pantalla completa, sin el shell
  // (sidebar/header) ni el gate de Términos. El proxy solo la deja pasar a
  // gyms bloqueados; aquí detectamos la ruta vía el header x-pathname.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.endsWith("/suspendida")) {
    return <>{children}</>;
  }

  const tieneAlertas = hasFeature(tenant.plan, "alertas_dueno");

  const [
    gym,
    miembrosVencenHoy,
    stockBajo,
    prospectosNuevos,
    alertas,
    addons,
    marca,
    currentStaff,
  ] = await Promise.all([
    getGymInfo(tenant.id),
    countMiembrosVencenHoy(tenant.id),
    countStockBajo(tenant.id),
    countProspectosNuevos(tenant.id),
    tieneAlertas ? getAlertas(tenant.id, slug) : Promise.resolve([]),
    listGymAddons(tenant.id),
    getGymMarca(tenant.id),
    getActiveStaff(tenant.id, user.id),
  ]);

  if (!gym) {
    redirect("/login");
  }

  // El usuario debe tener staff activo en este gym (el middleware ya lo
  // garantiza; esto es defensa en profundidad).
  if (!currentStaff) {
    redirect("/login?error=no-access");
  }

  // Colores personalizados solo para Pro+ (Básico usa defaults STRING).
  const aplicaColores =
    marca && hasFeature(tenant.plan, "personalizacion_colores");
  const marcaCss = aplicaColores
    ? `:root{--color-brand-green:${marca.color_acento};--color-sidebar:${marca.color_sidebar};--color-bg-content:${marca.color_fondo};}`
    : null;

  const alertasBadge = tieneAlertas
    ? alertas.reduce((sum, a) => sum + (a.count ?? 1), 0)
    : undefined;

  const badges = {
    miembros: miembrosVencenHoy,
    inventario: stockBajo,
    prospectos: prospectosNuevos,
    alertas: alertasBadge,
  };

  // Gate de Términos (Fase 7.3): bloquea el app hasta que el gym acepte.
  const debeAceptarTerminos = !gym.acepto_terminos_at;

  return (
    <ToastProvider>
      {marcaCss && (
        <style dangerouslySetInnerHTML={{ __html: marcaCss }} />
      )}
      {debeAceptarTerminos && <TerminosGate />}
      <StaffProvider staff={currentStaff}>
        <AddonsProvider addons={addons}>
          <div className="flex h-screen overflow-hidden bg-bg">
          <SidebarWithActiveSection
            slug={slug}
            plan={tenant.plan}
            gymNombre={gym.nombre}
            logoUrl={gym.logo_url}
            badges={badges}
          />

          <div className="flex flex-1 flex-col overflow-hidden bg-canvas">
            <Header gymNombre={gym.nombre} plan={tenant.plan} />

            <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
          </div>
          </div>
        </AddonsProvider>
      </StaffProvider>
    </ToastProvider>
  );
}
