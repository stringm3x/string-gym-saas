import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getPagoCompleto } from "@/lib/queries/pagos.queries";
import { Recibo } from "@/components/recibos/Recibo";
import { ReciboActions } from "@/components/recibos/ReciboActions";

interface PageProps {
  params: Promise<{ slug: string; pagoId: string }>;
}

export default async function ReciboPage({ params }: PageProps) {
  const { pagoId } = await params;
  const tenant = await getTenant();

  const pago = await getPagoCompleto(tenant.id, pagoId);
  if (!pago) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <ReciboActions />
      <Recibo pago={pago} />
    </div>
  );
}
