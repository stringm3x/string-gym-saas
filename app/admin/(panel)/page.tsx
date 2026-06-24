import { getCurrentAdmin } from "@/lib/admin/helpers";

/**
 * Dashboard del admin. En Bloque 2 es un placeholder con la sesión
 * confirmada; las métricas globales llegan en el Bloque 5.
 */
export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Hola, {admin?.nombre ?? "admin"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Bienvenido al panel interno de STRING.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">
          El dashboard con métricas globales (tenants, MRR, churn) se
          construye en el Bloque 5. La gestión de tenants llega en los
          Bloques 3 y 4.
        </p>
      </div>
    </div>
  );
}
