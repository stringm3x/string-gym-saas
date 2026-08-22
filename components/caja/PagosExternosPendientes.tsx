"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuLoaderCircle } from "react-icons/lu";
import { formatMoneda, formatFechaHora } from "@/lib/utils/format";
import type { PagoExternoPendiente } from "@/lib/queries/mercadopago.queries";

const STATUS_LABEL: Record<string, string> = {
  pending: "Esperando pago",
  in_process: "Procesando",
};

export function PagosExternosPendientes({
  pendientes,
}: {
  pendientes: PagoExternoPendiente[];
}) {
  const router = useRouter();

  // Mientras haya cobros de MP sin confirmar, refresca la página cada 15s
  // para que desaparezcan solos en cuanto el webhook los confirme (o se
  // reflejen como rechazados), sin que el cajero tenga que adivinar.
  useEffect(() => {
    if (pendientes.length === 0) return;
    const poll = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(poll);
  }, [pendientes.length, router]);

  if (pendientes.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
        <LuLoaderCircle className="h-3.5 w-3.5 animate-spin" />
        MercadoPago pendiente de confirmación ({pendientes.length})
      </h4>
      <ul className="space-y-1.5">
        {pendientes.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-text-primary">
                {p.descripcion ?? "Cobro con MercadoPago"}
              </p>
              <p className="text-xs text-text-muted">
                {formatFechaHora(p.createdAt)} ·{" "}
                {STATUS_LABEL[p.status] ?? p.status}
              </p>
            </div>
            <span className="shrink-0 font-mono font-semibold tabular-nums text-text-primary">
              {formatMoneda(p.monto)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
