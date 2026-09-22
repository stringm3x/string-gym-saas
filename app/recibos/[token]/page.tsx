import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPagoCompletoByToken } from "@/lib/queries/pagos.queries";
import { Recibo } from "@/components/recibos/Recibo";
import { ReciboPrintButton } from "@/components/recibos/ReciboPrintButton";

interface PageProps {
  params: Promise<{ token: string }>;
}

const TAGLINE = "Recibo de pago";

/**
 * Bloque 10 sueltos (privacidad): la tarjeta de WhatsApp/Slack para este
 * link mostraba la marca de STRING, no la del gimnasio. Ahora lleva la
 * marca del gimnasio — nombre y logo, sin monto ni nombre del socio (esos
 * solo aparecen en el cuerpo del recibo, no en metadata compartible).
 * `robots: noindex` es defensa en profundidad sobre el header que ya manda
 * proxy.ts. `referrer: no-referrer` evita que el logo del gimnasio (un
 * recurso externo) reciba el token de este recibo en el header Referer.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const pago = await getPagoCompletoByToken(token);
  const gymNombre = pago?.gym_nombre || "STRING GYM";
  const logoUrl = pago?.gym_logo_url ?? undefined;

  return {
    title: `${gymNombre} — ${TAGLINE}`,
    description: TAGLINE,
    referrer: "no-referrer",
    robots: { index: false, follow: false },
    openGraph: {
      title: gymNombre,
      description: TAGLINE,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

export default async function ReciboPublicoPage({ params }: PageProps) {
  const { token } = await params;
  const pago = await getPagoCompletoByToken(token);

  if (!pago) notFound();

  // Pago anulado → recibo invalidado (equivalente a 410 Gone en UX).
  if (pago.anulado_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="max-w-sm space-y-2 text-center">
          <p className="text-xl text-text-primary font-semibold">
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
