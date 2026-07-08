import Link from "next/link";
import { LuWallet, LuReceipt } from "react-icons/lu";
import { formatMoneda, formatFechaHora } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { PagoConMiembro } from "@/lib/queries/pagos.queries";

interface PagosFeedProps {
  pagos: PagoConMiembro[];
  slug: string;
}

const conceptoLabels: Record<string, string> = {
  membresia: "Membresía",
  visita: "Visita",
  producto: "Producto",
  otro: "Otro",
};

export function PagosFeed({ pagos, slug }: PagosFeedProps) {
  if (pagos.length === 0) {
    return (
      <EmptyState
        icon={<LuWallet className="h-5 w-5" />}
        title="Sin pagos hoy"
        description="Cuando registres el primer cobro del día, aparecerá aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {pagos.map((p) => (
        <li
          key={p.id}
          className={`flex items-center justify-between gap-4 px-4 py-3 ${
            p.anulado_at ? "opacity-50" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Badge
              variant={p.es_visita_rapida ? "info" : "neutral"}
              className="shrink-0"
            >
              {p.es_visita_rapida
                ? "Visita"
                : (conceptoLabels[p.concepto] ?? p.concepto)}
            </Badge>
            <div className="min-w-0">
              {p.es_visita_rapida ? (
                <p className="truncate text-sm font-medium text-text-primary">
                  {p.nombre_visitante ?? "Visitante"}
                </p>
              ) : p.miembro_id && p.miembro_nombre ? (
                <Link
                  href={`/${slug}/miembros/${p.miembro_id}`}
                  className="truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-green"
                >
                  {p.miembro_nombre}
                </Link>
              ) : (
                <p className="truncate text-sm text-text-secondary">
                  Sin miembro
                </p>
              )}
              <p className="text-xs text-text-muted">
                {formatFechaHora(p.fecha_pago)} · {p.metodo_pago}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {p.anulado_at && <Badge variant="danger">Anulado</Badge>}
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                p.anulado_at
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }`}
            >
              {formatMoneda(p.monto)}
            </span>
            <Link
              href={`/${slug}/recibos/${p.id}`}
              title="Ver recibo"
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <LuReceipt className="h-4 w-4" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
