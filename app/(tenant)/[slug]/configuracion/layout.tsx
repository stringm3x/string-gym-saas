import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { ConfigTabs } from "@/components/configuracion/ConfigTabs";

export default async function ConfiguracionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenant();

  // Toda la configuración es del dueño; el recepcionista va a check-ins.
  if (!hasPermission(tenant.role, "configurar_general")) {
    redirect(`/${slug}/checkins`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Configuración
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Administra los catálogos del gimnasio.
        </p>
      </div>

      <ConfigTabs slug={slug} plan={tenant.plan} role={tenant.role} />

      <div>{children}</div>
    </div>
  );
}
