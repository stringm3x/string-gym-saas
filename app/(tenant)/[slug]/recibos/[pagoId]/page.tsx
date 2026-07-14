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
    <div className="mx-auto max-w-lg space-y-4">
      <ReciboActions />

      {pago.anulado_at ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm font-medium text-danger print:hidden">
          Este pago fue anulado.
        </p>
      ) : pago.reembolsado_at ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm font-medium text-warning print:hidden">
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
        <div className="rounded-lg border border-border bg-surface p-4 print:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Reembolsos
          </h3>
          <ul className="mt-2 space-y-1.5">
            {reembolsos.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-text-secondary">
                  {formatMoneda(r.monto)} · {r.tipo}
                  {r.creado_por_nombre && ` · ${r.creado_por_nombre}`}
                </span>
                {r.motivo && (
                  <span className="truncate pl-2 text-xs italic text-text-muted">
                    {r.motivo}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
