import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { CuentaActions } from "@/components/admin/CuentaActions";
import { TZ_MX } from "@/lib/utils/dates";

function fechaHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CuentaPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Mi cuenta</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Datos de tu sesión de administrador.
        </p>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-text-muted">Nombre</dt>
          <dd className="text-text-primary">{admin.nombre ?? "—"}</dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-text-muted">Email</dt>
          <dd className="text-text-primary">{admin.email}</dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-text-muted">Rol</dt>
          <dd className="capitalize text-text-primary">
            {admin.role.replace("_", " ")}
          </dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-text-muted">Último acceso</dt>
          <dd className="text-text-primary">{fechaHora(admin.ultimo_acceso)}</dd>
        </div>
      </dl>

      <CuentaActions />
    </div>
  );
}
