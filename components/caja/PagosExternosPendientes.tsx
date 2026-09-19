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
    <section className="border border-warning/40 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h4 className="flex items-center gap-2 font-mono text-etiqueta uppercase text-warning">
          <LuLoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          MercadoPago por confirmar
        </h4>
        <span className="font-mono text-etiqueta text-text-muted">
          {pendientes.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {pendientes.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 px-5 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-5 text-text-primary">
                {p.descripcion ?? "Cobro con MercadoPago"}
              </p>
              <p className="text-sm text-text-muted">
                <span className="font-mono">{formatFechaHora(p.createdAt)}</span>{" "}
                · {STATUS_LABEL[p.status] ?? p.status}
              </p>
            </div>
            <span className="shrink-0 font-mono text-dato tabular-nums text-text-primary">
              {formatMoneda(p.monto)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
