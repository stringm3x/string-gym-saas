import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getPagoCompleto } from "@/lib/queries/pagos.queries";
import { getReembolsosByPago } from "@/lib/queries/reembolsos.queries";
import { hasPermission } from "@/lib/permissions";
import { formatMoneda } from "@/lib/utils/format";
import { Recibo } from "@/components/recibos/Recibo";
import { ReciboActions } from "@/components/recibos/ReciboActions";
import { AnularPagoButton } from "@/components/recibos/AnularPagoButton";
import { ReembolsarPagoButton } from "@/components/recibos/ReembolsarPagoButton";

interface PageProps {
  params: Promise<{ slug: string; pagoId: string }>;
}

export default async function ReciboPage({ params }: PageProps) {
  const { pagoId } = await params;
  const tenant = await getTenant();

  const pago = await getPagoCompleto(tenant.id, pagoId);
  if (!pago) notFound();

  const reembolsos = pago.reembolsado_at
    ? await getReembolsosByPago(tenant.id, pago.id)
    : [];

  const puedeGestionar =
    !pago.anulado_at &&
    !pago.reembolsado_at &&
    hasPermission(tenant.role, "cancelar_pagos");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <ReciboActions />

      {pago.anulado_at ? (
        <p className="border border-danger/40 px-4 py-3 text-center text-sm text-danger print:hidden">
          Este pago fue anulado.
        </p>
      ) : pago.reembolsado_at ? (
        <p className="border border-warning/40 px-4 py-3 text-center text-sm text-warning print:hidden">
          Este pago fue reembolsado.
          {pago.reembolsado_motivo && ` (${pago.reembolsado_motivo})`}
        </p>
      ) : (
        puedeGestionar && (
          <div className="flex justify-end gap-2 print:hidden">
            <ReembolsarPagoButton
              pagoId={pago.id}
              monto={pago.monto}
              tieneMiembro={!!pago.miembro_id}
            />
            <AnularPagoButton pagoId={pago.id} />
          </div>
        )
      )}

      <Recibo pago={pago} />

      {reembolsos.length > 0 && (
        <section className="card-surface print:hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-text-primary">
              Reembolsos
            </h3>
            <span className="font-mono text-etiqueta text-text-muted">
              {reembolsos.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {reembolsos.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[15px] leading-5 text-text-primary">
                    {r.tipo}
                    {r.creado_por_nombre && (
                      <span className="text-text-muted">
                        {" "}
                        · {r.creado_por_nombre}
                      </span>
                    )}
                  </p>
                  {r.motivo && (
                    <p className="truncate text-sm text-text-muted">{r.motivo}</p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-dato tabular-nums text-text-primary">
                  {formatMoneda(r.monto)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
