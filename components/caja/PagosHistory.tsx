import Link from "next/link";
import { LuWallet, LuReceipt } from "react-icons/lu";
import { formatMoneda, formatFecha } from "@/lib/utils/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Pago } from "@/lib/queries/pagos.queries";

interface PagosHistoryProps {
  pagos: Pago[];
  slug: string;
}

const conceptoLabels: Record<string, string> = {
  membresia: "Membresía",
  visita: "Visita",
  producto: "Producto",
  otro: "Otro",
};

export function PagosHistory({ pagos, slug }: PagosHistoryProps) {
  if (pagos.length === 0) {
    return (
      <EmptyState
        icon={<LuWallet className="h-5 w-5" />}
        title="Sin pagos registrados"
        description="Los pagos de este miembro aparecerán aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {pagos.map((p) => {
        const anulado = !!p.anulado_at;
        return (
          <li
            key={p.id}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${
              anulado ? "opacity-50" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Badge
                variant="neutral"
                className={`shrink-0 ${anulado ? "line-through" : ""}`}
              >
                {conceptoLabels[p.concepto] ?? p.concepto}
              </Badge>
              <div className="min-w-0">
                <p className="text-xs text-text-secondary">
                  {formatFecha(p.fecha_pago)} · {p.metodo_pago}
                </p>
                {p.periodo_inicio && p.periodo_fin && (
                  <p className="text-xs text-text-muted">
                    Vigencia: {formatFecha(p.periodo_inicio)} →{" "}
                    {formatFecha(p.periodo_fin)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {anulado && <Badge variant="danger">Anulado</Badge>}
              <span
                className={`font-mono text-sm font-semibold tabular-nums ${
                  anulado
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
        );
      })}
    </ul>
  );
}
