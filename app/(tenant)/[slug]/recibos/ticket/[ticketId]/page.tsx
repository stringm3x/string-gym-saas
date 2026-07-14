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

export default async function TicketReciboPage({ params }: PageProps) {
  const { ticketId } = await params;
  const tenant = await getTenant();

  const ticket = await getTicketCompleto(tenant.id, ticketId);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <ReciboActions />

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide text-text-primary">
            {ticket.gym_nombre}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Ticket · {formatFecha(ticket.fecha_pago)}
            {ticket.metodo_pago &&
              ` · ${METODO_LABEL[ticket.metodo_pago] ?? ticket.metodo_pago}`}
          </p>
          {ticket.miembro_nombre && (
            <p className="mt-0.5 text-sm text-text-secondary">
              {ticket.miembro_nombre}
            </p>
          )}
        </div>

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {ticket.lineas.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="text-text-primary">{nombreLinea(l)}</span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatMoneda(l.monto)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm uppercase tracking-wider text-text-muted">
            Total
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums text-brand-green">
            {formatMoneda(ticket.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
