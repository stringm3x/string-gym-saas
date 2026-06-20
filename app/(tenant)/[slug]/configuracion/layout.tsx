import { getTenant } from "@/lib/tenant";
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
