import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { ConfigNav } from "@/components/configuracion/ConfigNav";

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

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-2">
            <ConfigNav slug={slug} plan={tenant.plan} role={tenant.role} />
          </div>
        </aside>
        <div className="min-w-0 rounded-xl border border-border bg-surface p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
