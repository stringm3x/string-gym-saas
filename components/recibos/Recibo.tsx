import Image from "next/image";
import { formatFecha, formatMoneda } from "@/lib/utils/format";
import type { PagoCompleto } from "@/lib/queries/pagos.queries";

const conceptoLabels: Record<string, string> = {
  membresia: "Membresía",
  visita: "Visita de cortesía",
  producto: "Venta de producto",
  otro: "Otro",
};

const metodoLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

interface ReciboProps {
  pago: PagoCompleto;
}

/**
 * Recibo de pago: documento claro para imprimir. Tokens `paper`, nombre
 * del gimnasio en Geist, folio y cifras en mono. Sin verde: es papel.
 */
export function Recibo({ pago }: ReciboProps) {
  const folioStr = pago.folio
    ? `#${String(pago.folio).padStart(4, "0")}`
    : "—";

  return (
    <div className="mx-auto max-w-md border border-paper-line bg-paper p-8 text-paper-ink print:max-w-none print:border-0 print:p-0">
      {/* Gym header */}
      <div className="border-b border-paper-line pb-5">
        {pago.gym_logo_url ? (
          <Image
            src={pago.gym_logo_url}
            alt={pago.gym_nombre}
            width={200}
            height={60}
            unoptimized
            className="mb-2 h-14 w-auto max-w-[200px] object-contain object-left"
          />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-paper-ink">
            {pago.gym_nombre || "GYM"}
          </p>
        )}
        {pago.gym_telefono && (
          <p className="mt-1 text-sm text-paper-ink-faint">
            Tel: <span className="font-mono">{pago.gym_telefono}</span>
          </p>
        )}
        {pago.gym_direccion && (
          <p className="text-sm text-paper-ink-faint">{pago.gym_direccion}</p>
        )}
        {pago.gym_rfc && (
          <p className="text-sm text-paper-ink-faint">
            RFC: <span className="font-mono">{pago.gym_rfc}</span>
          </p>
        )}
      </div>

      {/* Recibo header */}
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-etiqueta uppercase text-paper-ink-faint">
            Recibo de pago
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-paper-ink">
            {folioStr}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-etiqueta uppercase text-paper-ink-faint">
            Fecha
          </p>
          <p className="mt-1 font-mono text-dato tabular-nums text-paper-ink-soft">
            {formatFecha(pago.fecha_pago)}
          </p>
        </div>
      </div>

      {/* Detalle */}
      <dl className="mt-6 divide-y divide-paper-line border-y border-paper-line">
        <Row label="Cliente" value={pago.miembro_nombre ?? "Sin miembro"} />
        <Row
          label="Concepto"
          value={conceptoLabels[pago.concepto] ?? pago.concepto}
        />
        {pago.periodo_inicio && pago.periodo_fin && (
          <Row
            label="Vigencia"
            value={`${formatFecha(pago.periodo_inicio)} → ${formatFecha(pago.periodo_fin)}`}
            mono
          />
        )}
        <Row
          label="Método"
          value={metodoLabels[pago.metodo_pago ?? ""] ?? pago.metodo_pago ?? "—"}
        />
      </dl>

      {/* Total */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="font-mono text-etiqueta uppercase text-paper-ink-faint">
          Total
        </p>
        <p className="font-mono text-[36px] font-bold leading-10 tabular-nums text-paper-ink">
          {formatMoneda(pago.monto)}
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 border-t border-paper-line pt-4 text-center text-xs text-paper-ink-faint">
        Gracias por tu preferencia · {pago.gym_nombre}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="font-mono text-etiqueta uppercase text-paper-ink-faint">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "text-right font-mono text-dato tabular-nums text-paper-ink"
            : "text-right text-sm font-medium text-paper-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
