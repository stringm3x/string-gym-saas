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
    <div className="flex max-w-lg flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Panel interno
        </p>
        <h1 className="text-pagina font-semibold text-text-primary">Mi cuenta</h1>
        <p className="text-sm text-text-secondary">
          Datos de tu sesión de administrador.
        </p>
      </div>

      <dl className="card-surface divide-y divide-border">
        <div className="flex min-h-11 items-center justify-between gap-4 px-5 py-3">
          <dt className="font-mono text-etiqueta uppercase text-text-secondary">
            Nombre
          </dt>
          <dd className="text-sm text-text-primary">{admin.nombre ?? "—"}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 px-5 py-3">
          <dt className="font-mono text-etiqueta uppercase text-text-secondary">
            Correo
          </dt>
          <dd className="text-sm text-text-primary">{admin.email}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 px-5 py-3">
          <dt className="font-mono text-etiqueta uppercase text-text-secondary">
            Rol
          </dt>
          <dd className="text-sm capitalize text-text-primary">
            {admin.role.replace("_", " ")}
          </dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 px-5 py-3">
          <dt className="font-mono text-etiqueta uppercase text-text-secondary">
            Último acceso
          </dt>
          <dd className="font-mono text-dato tabular-nums text-text-primary">
            {fechaHora(admin.ultimo_acceso)}
          </dd>
        </div>
      </dl>

      <CuentaActions />
    </div>
  );
}
