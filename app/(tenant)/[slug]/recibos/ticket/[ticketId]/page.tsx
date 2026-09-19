import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getTicketCompleto } from "@/lib/queries/pagos.queries";
import { formatMoneda, formatFecha } from "@/lib/utils/format";
import { ReciboActions } from "@/components/recibos/ReciboActions";

interface PageProps {
  params: Promise<{ slug: string; ticketId: string }>;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function nombreLinea(l: {
  concepto: string;
  producto_nombre: string | null;
  plan_nombre: string | null;
}): string {
  if (l.concepto === "producto") return l.producto_nombre ?? "Producto";
  if (l.concepto === "membresia")
    return l.plan_nombre ? `Membresía ${l.plan_nombre}` : "Membresía";
  return l.concepto;
}

/** Ticket multi-línea: mismo papel que el recibo (tokens `paper`, mono en
 * cifras, nombre del gimnasio en Geist). */
export default async function TicketReciboPage({ params }: PageProps) {
  const { ticketId } = await params;
  const tenant = await getTenant();

  const ticket = await getTicketCompleto(tenant.id, ticketId);
  if (!ticket) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <ReciboActions />

      <div className="mx-auto w-full max-w-md border border-paper-line bg-paper p-8 text-paper-ink print:max-w-none print:border-0 print:p-0">
        <div className="border-b border-paper-line pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-paper-ink">
            {ticket.gym_nombre}
          </h1>
          {ticket.miembro_nombre && (
            <p className="mt-1 text-sm text-paper-ink-soft">
              {ticket.miembro_nombre}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-etiqueta uppercase text-paper-ink-faint">
              Ticket
            </p>
            <p className="mt-1 text-sm text-paper-ink-soft">
              {ticket.metodo_pago
                ? (METODO_LABEL[ticket.metodo_pago] ?? ticket.metodo_pago)
                : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-etiqueta uppercase text-paper-ink-faint">
              Fecha
            </p>
            <p className="mt-1 font-mono text-dato tabular-nums text-paper-ink-soft">
              {formatFecha(ticket.fecha_pago)}
            </p>
          </div>
        </div>

        <ul className="mt-6 divide-y divide-paper-line border-y border-paper-line">
          {ticket.lineas.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <span className="text-sm text-paper-ink">{nombreLinea(l)}</span>
              <span className="font-mono text-dato tabular-nums text-paper-ink">
                {formatMoneda(l.monto)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-end justify-between gap-4">
          <span className="font-mono text-etiqueta uppercase text-paper-ink-faint">
            Total
          </span>
          <span className="font-mono text-[36px] font-bold leading-10 tabular-nums text-paper-ink">
            {formatMoneda(ticket.total)}
          </span>
        </div>

        <p className="mt-8 border-t border-paper-line pt-4 text-center text-xs text-paper-ink-faint">
          Gracias por tu preferencia · {ticket.gym_nombre}
        </p>
      </div>
    </div>
  );
}
