import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { countMiembrosVencenHoy } from "@/lib/queries/miembros.queries";
import { countCongelacionesPendientes } from "@/lib/queries/miembro-eventos.queries";
import { countStockBajo } from "@/lib/queries/productos.queries";
import { countProspectosNuevos } from "@/lib/queries/prospectos.queries";
import { getAlertas } from "@/lib/queries/alertas.queries";
import { listGymAddons } from "@/lib/queries/addons.queries";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import { countCodigosPendientes } from "@/lib/queries/kiosco.queries";
import { countNoLeidos } from "@/lib/queries/inbox.queries";
import {
  getNotificaciones,
  countNotificacionesNoLeidas,
} from "@/lib/queries/notifications.queries";
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
  const tieneAutoservicio = hasFeature(tenant.plan, "kiosco_autoservicio");
  const tieneWhatsapp = hasFeature(tenant.plan, "whatsapp_automatico");

  const [
    gym,
    miembrosVencenHoy,
    congelacionesPendientes,
    stockBajo,
    prospectosNuevos,
    alertas,
    addons,
    currentStaff,
    notificaciones,
    notificacionesNoLeidas,
    codigosPendientes,
    waNoLeidos,
  ] = await Promise.all([
    getGymInfo(tenant.id),
    countMiembrosVencenHoy(tenant.id),
    countCongelacionesPendientes(tenant.id),
    countStockBajo(tenant.id),
    countProspectosNuevos(tenant.id),
    tieneAlertas ? getAlertas(tenant.id, slug) : Promise.resolve([]),
    listGymAddons(tenant.id),
    getActiveStaff(tenant.id, user.id),
    getNotificaciones(tenant.id),
    countNotificacionesNoLeidas(tenant.id),
    tieneAutoservicio
      ? countCodigosPendientes(tenant.id)
      : Promise.resolve(0),
    tieneWhatsapp ? countNoLeidos(tenant.id) : Promise.resolve(0),
  ]);

  if (!gym) {
    redirect("/login");
  }

  // El usuario debe tener staff activo en este gym (el middleware ya lo
  // garantiza; esto es defensa en profundidad).
  if (!currentStaff) {
    redirect("/login?error=no-access");
  }

  // Guía de primer acceso (Fase P.1): el owner que no la completó va a
  // /onboarding, excepto si ya está ahí o en configuración.
  const seccion = pathname.split("/").filter(Boolean)[1] ?? "";
  if (
    tenant.role === "owner" &&
    gym.onboarding_completado === false &&
    seccion !== "onboarding" &&
    seccion !== "configuracion"
  ) {
    redirect(`/${slug}/onboarding`);
  }

  const alertasBadge = tieneAlertas
    ? alertas.reduce((sum, a) => sum + (a.count ?? 1), 0)
    : undefined;

  const badges = {
    miembros: miembrosVencenHoy + congelacionesPendientes,
    inventario: stockBajo,
    prospectos: prospectosNuevos,
    alertas: alertasBadge,
    caja: codigosPendientes,
    whatsapp: waNoLeidos,
  };

  // Gate de Términos (Fase 7.3): bloquea el app hasta que el gym acepte.
  // Solo para el owner: es quien puede aceptar (aceptarTerminos hace UPDATE
  // sobre gyms, y la única policy es owner_id = auth.uid()). Antes se
  // montaba para cualquier rol; un gerente o recepcionista que entrara
  // antes que el dueño aceptaba, el update afectaba 0 filas sin error,
  // el modal se cerraba, refrescaba y volvía a aparecer — atrapado sin
  // poder salir salvo cerrando sesión a mano.
  // Solo el owner: aceptar Términos tiene efecto legal sobre la cuenta y lo
  // hace su dueño, no quien la administra (decisión 2026-09-20; ver
  // panel.aceptar_terminos en lib/authz/politicas.ts). No es un gate de
  // permiso y no debe migrarse a hasPermission.
  const debeAceptarTerminos =
    !gym.acepto_terminos_at && tenant.role === "owner";

  return (
    <ToastProvider>
      {debeAceptarTerminos && <TerminosGate />}
      <StaffProvider staff={currentStaff}>
        <AddonsProvider addons={addons}>
          <div className="flex h-screen overflow-hidden bg-bg">
          <SidebarWithActiveSection
            slug={slug}
            plan={tenant.plan}
            gymNombre={gym.nombre}
            logoUrl={gym.logo_url}
            initialCollapsed={
              (await cookies()).get("sidebar_collapsed")?.value === "1"
            }
            badges={badges}
          />

          <div className="flex flex-1 flex-col overflow-hidden bg-canvas">
            <Header
              gymNombre={gym.nombre}
              plan={tenant.plan}
              slug={slug}
              notificaciones={notificaciones}
              notificacionesNoLeidas={notificacionesNoLeidas}
            />

            <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
          </div>
          </div>
        </AddonsProvider>
      </StaffProvider>
    </ToastProvider>
  );
}
