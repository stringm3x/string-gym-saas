import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getPagoCompleto } from "@/lib/queries/pagos.queries";
import { hasPermission } from "@/lib/permissions";
import { Recibo } from "@/components/recibos/Recibo";
import { ReciboActions } from "@/components/recibos/ReciboActions";
import { AnularPagoButton } from "@/components/recibos/AnularPagoButton";

interface PageProps {
  params: Promise<{ slug: string; pagoId: string }>;
}

export default async function ReciboPage({ params }: PageProps) {
  const { pagoId } = await params;
  const tenant = await getTenant();

  const pago = await getPagoCompleto(tenant.id, pagoId);
  if (!pago) notFound();

  const puedeAnular =
    !pago.anulado_at && hasPermission(tenant.role, "cancelar_pagos");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <ReciboActions />

      {pago.anulado_at ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm font-medium text-danger print:hidden">
          Este pago fue anulado.
        </p>
      ) : (
        puedeAnular && (
          <div className="flex justify-end print:hidden">
            <AnularPagoButton pagoId={pago.id} />
          </div>
        )
      )}

      <Recibo pago={pago} />
    </div>
  );
}
