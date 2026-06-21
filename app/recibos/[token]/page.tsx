import { notFound } from "next/navigation";
import { getPagoCompletoByToken } from "@/lib/queries/pagos.queries";
import { Recibo } from "@/components/recibos/Recibo";
import { ReciboPrintButton } from "@/components/recibos/ReciboPrintButton";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: "Recibo de pago",
};

export default async function ReciboPublicoPage({ params }: PageProps) {
  const { token } = await params;
  const pago = await getPagoCompletoByToken(token);

  if (!pago) notFound();

  // Pago anulado → recibo invalidado (equivalente a 410 Gone en UX).
  if (pago.anulado_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="max-w-sm space-y-2 text-center">
          <p className="font-display text-2xl uppercase tracking-wide text-text-primary">
            Recibo no válido
          </p>
          <p className="text-sm text-text-secondary">
            Este recibo fue anulado por el gimnasio y ya no es válido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg space-y-4">
        <ReciboPrintButton />
        <Recibo pago={pago} />
      </div>
    </div>
  );
}
