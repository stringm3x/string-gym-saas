import { requirePanel } from "@/lib/authz/pagina";
import { ConfigNav } from "@/components/configuracion/ConfigNav";

export default async function ConfiguracionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Configuración es de owner y gerente; el recepcionista va a check-ins.
  const g = await requirePanel("pagina.configuracion", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // miembros es Starter: no ocurre
  const tenant = g.ctx;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Ajustes del gimnasio
        </p>
        <h2 className="text-pagina font-semibold text-text-primary">
          Configuración
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="border border-border bg-surface p-2">
            <ConfigNav slug={slug} plan={tenant.plan} role={tenant.role} />
          </div>
        </aside>
        <div className="min-w-0 border border-border bg-surface p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
