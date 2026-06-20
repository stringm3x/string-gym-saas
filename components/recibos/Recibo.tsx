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

export function Recibo({ pago }: ReciboProps) {
  const folioStr = pago.folio
    ? `#${String(pago.folio).padStart(4, "0")}`
    : "—";

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-gray-900 shadow-sm print:shadow-none print:border-0">
      {/* Gym header */}
      <div className="border-b border-gray-200 pb-5">
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
          <p className="font-display text-2xl font-bold uppercase tracking-wide text-gray-900">
            {pago.gym_nombre || "GYM"}
          </p>
        )}
        {pago.gym_telefono && (
          <p className="mt-1 text-sm text-gray-500">Tel: {pago.gym_telefono}</p>
        )}
        {pago.gym_direccion && (
          <p className="text-sm text-gray-500">{pago.gym_direccion}</p>
        )}
        {pago.gym_rfc && (
          <p className="text-sm text-gray-500">RFC: {pago.gym_rfc}</p>
        )}
      </div>

      {/* Recibo header */}
      <div className="mt-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Recibo de pago
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
            {folioStr}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Fecha</p>
          <p className="text-sm font-medium text-gray-700">
            {formatFecha(pago.fecha_pago)}
          </p>
        </div>
      </div>

      {/* Detalle */}
      <div className="mt-6 space-y-3 rounded-xl bg-gray-50 p-4">
        <Row
          label="Cliente"
          value={pago.miembro_nombre ?? "Sin miembro"}
        />
        <Row
          label="Concepto"
          value={conceptoLabels[pago.concepto] ?? pago.concepto}
        />
        {pago.periodo_inicio && pago.periodo_fin && (
          <Row
            label="Vigencia"
            value={`${formatFecha(pago.periodo_inicio)} → ${formatFecha(pago.periodo_fin)}`}
          />
        )}
        <Row
          label="Método de pago"
          value={metodoLabels[pago.metodo_pago ?? ""] ?? pago.metodo_pago ?? "—"}
        />
      </div>

      {/* Total */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Total
        </p>
        <p className="font-mono text-3xl font-bold tabular-nums text-gray-900">
          {formatMoneda(pago.monto)}
        </p>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-gray-400">
        Gracias por tu preferencia · {pago.gym_nombre}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">
        {value}
      </span>
    </div>
  );
}
