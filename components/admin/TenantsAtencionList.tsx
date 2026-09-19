import Link from "next/link";
import type {
  AtencionTenant,
  TenantsAtencion,
} from "@/lib/queries/admin.queries";

// Cada grupo: kicker mono con punto indicador y conteo, y filas clicables de
// 44px. El punto es de los pocos círculos permitidos (indicador de estado).
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
      <h4 className="flex items-center gap-2 px-5 pb-2 pt-4 font-mono text-etiqueta uppercase text-text-muted">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accent}`} />
        {titulo}
        <span className="tabular-nums">({items.length})</span>
      </h4>
      {items.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-text-muted">
          Ningún gimnasio en este grupo.
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/tenants/${t.id}`}
                className="flex min-h-11 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-hover/60"
              >
                <span className="truncate text-sm text-text-primary">
                  {t.nombre}
                </span>
                <span className="shrink-0 text-sm text-text-muted">
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
  const total =
    data.pruebaPorVencer.length +
    data.suspendidosViejos.length +
    data.exportPendiente.length;

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Requieren atención
        </h3>
        <span className="font-mono text-etiqueta tabular-nums text-text-muted">
          {total}
        </span>
      </div>
      <div className="divide-y divide-border">
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
    </section>
  );
}
