import Link from "next/link";
import type {
  AtencionTenant,
  TenantsAtencion,
} from "@/lib/queries/admin.queries";

function Grupo({
  titulo,
  items,
  accent,
}: {
  titulo: string;
  items: AtencionTenant[];
  accent: string;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-primary">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        {titulo}
        <span className="text-text-muted">({items.length})</span>
      </h4>
      {items.length === 0 ? (
        <p className="text-[11px] text-text-muted">Nada por aquí.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/tenants/${t.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 hover:bg-surface"
              >
                <span className="truncate text-xs font-medium text-text-primary">
                  {t.nombre}
                </span>
                <span className="shrink-0 text-[11px] text-text-muted">
                  {t.detalle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TenantsAtencionList({ data }: { data: TenantsAtencion }) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">
        Requieren atención
      </h3>
      <Grupo
        titulo="Prueba por vencer (7 días)"
        items={data.pruebaPorVencer}
        accent="bg-warning"
      />
      <Grupo
        titulo="Suspendidos hace +30 días"
        items={data.suspendidosViejos}
        accent="bg-danger"
      />
      <Grupo
        titulo="Exportación pendiente"
        items={data.exportPendiente}
        accent="bg-text-muted"
      />
    </div>
  );
}
