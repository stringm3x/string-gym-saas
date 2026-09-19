import Link from "next/link";
import { formatMoneda, formatFecha } from "@/lib/utils/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
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

const metodoLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mercadopago: "MercadoPago",
};

/** Historial de pagos de la ficha: fecha y monto en mono, el monto enlaza
 * al recibo. Va dentro de una tarjeta con cabecera (la pone la página). */
export function PagosHistory({ pagos, slug }: PagosHistoryProps) {
  if (pagos.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Sin pagos registrados.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {pagos.map((p) => {
        const anulado = !!p.anulado_at;
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center justify-between gap-4 px-5 py-3",
              anulado && "opacity-50"
            )}
          >
            <div className="flex min-w-0 items-center gap-4">
              <span className="w-[76px] shrink-0 font-mono text-dato tabular-nums text-text-secondary">
                {formatFecha(p.fecha_pago)}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] leading-5 text-text-primary">
                  {conceptoLabels[p.concepto] ?? p.concepto}
                  {anulado && <Badge variant="danger">Anulado</Badge>}
                </p>
                <p className="text-sm text-text-muted">
                  {metodoLabels[p.metodo_pago ?? ""] ?? p.metodo_pago}
                  {p.periodo_inicio && p.periodo_fin && (
                    <>
                      {" · "}
                      <span className="font-mono">
                        {formatFecha(p.periodo_inicio)} →{" "}
                        {formatFecha(p.periodo_fin)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Link
              href={`/${slug}/recibos/${p.id}`}
              title="Ver recibo"
              className={cn(
                "shrink-0 font-mono text-dato tabular-nums underline-offset-4 hover:text-brand-green hover:underline",
                anulado ? "text-text-muted line-through" : "text-text-primary"
              )}
            >
              {formatMoneda(p.monto)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
