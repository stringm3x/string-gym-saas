import Link from "next/link";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import type { PagoConMiembro } from "@/lib/queries/pagos.queries";

interface PagosFeedProps {
  pagos: PagoConMiembro[];
  slug: string;
}

const conceptoLabels: Record<string, string> = {
  membresia: "Membresía",
  visita: "Visita",
  producto: "Producto",
  otro: "Otro",
};

const metodoLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mercadopago: "MercadoPago",
};

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

type Entry =
  | { kind: "single"; pago: PagoConMiembro }
  | { kind: "ticket"; ticketId: string; lineas: PagoConMiembro[] };

/** Agrupa las líneas de un mismo ticket en un solo renglón (B4). */
function agrupar(pagos: PagoConMiembro[]): Entry[] {
  const entries: Entry[] = [];
  const vistos = new Set<string>();
  for (const p of pagos) {
    if (p.ticket_id) {
      if (vistos.has(p.ticket_id)) continue;
      vistos.add(p.ticket_id);
      entries.push({
        kind: "ticket",
        ticketId: p.ticket_id,
        lineas: pagos.filter((x) => x.ticket_id === p.ticket_id),
      });
    } else {
      entries.push({ kind: "single", pago: p });
    }
  }
  return entries;
}

/**
 * Movimientos del turno (artboard "Caja"): tabla con encabezados en mono
 * (HORA, SOCIO, CONCEPTO, MÉTODO, MONTO). Hora y monto en mono; el monto
 * enlaza al recibo.
 */
export function PagosFeed({ pagos, slug }: PagosFeedProps) {
  if (pagos.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Todavía no hay cobros. El primero aparecerá aquí.
      </p>
    );
  }

  const entries = agrupar(pagos);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <Th className="w-16">Hora</Th>
            <Th>Socio</Th>
            <Th className="hidden md:table-cell">Concepto</Th>
            <Th className="hidden md:table-cell">Método</Th>
            <Th className="text-right">Monto</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e) =>
            e.kind === "ticket" ? (
              <TicketRow key={e.ticketId} entry={e} slug={slug} />
            ) : (
              <PagoRow key={e.pago.id} pago={e.pago} slug={slug} />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-5 py-3 text-left font-mono text-etiqueta font-normal uppercase text-text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-5 py-3 align-middle", className)}>{children}</td>;
}

function TicketRow({
  entry,
  slug,
}: {
  entry: { ticketId: string; lineas: PagoConMiembro[] };
  slug: string;
}) {
  const first = entry.lineas[0];
  const total = entry.lineas.reduce((s, l) => s + l.monto, 0);
  const n = entry.lineas.length;
  return (
    <tr className="transition-colors hover:bg-surface-hover">
      <Td>
        <span className="font-mono text-dato tabular-nums text-text-secondary">
          {hora(first.fecha_pago)}
        </span>
      </Td>
      <Td>
        {first.miembro_id && first.miembro_nombre ? (
          <Link
            href={`/${slug}/miembros/${first.miembro_id}`}
            className="block truncate text-[15px] leading-5 text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
          >
            {first.miembro_nombre}
          </Link>
        ) : (
          <span className="block truncate text-[15px] leading-5 text-text-secondary">
            Sin miembro
          </span>
        )}
        <span className="block text-sm text-text-muted md:hidden">
          Ticket · {n} {n === 1 ? "línea" : "líneas"}
        </span>
      </Td>
      <Td className="hidden md:table-cell">
        <span className="text-sm text-text-secondary">
          Ticket · {n} {n === 1 ? "línea" : "líneas"}
        </span>
      </Td>
      <Td className="hidden md:table-cell">
        <span className="text-sm text-text-secondary">
          {metodoLabels[first.metodo_pago ?? ""] ?? first.metodo_pago}
        </span>
      </Td>
      <Td className="text-right">
        <Link
          href={`/${slug}/recibos/ticket/${entry.ticketId}`}
          title="Ver ticket"
          className="font-mono text-dato tabular-nums text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
        >
          {formatMoneda(total)}
        </Link>
      </Td>
    </tr>
  );
}

function PagoRow({ pago: p, slug }: { pago: PagoConMiembro; slug: string }) {
  const inactivo = !!p.anulado_at || !!p.reembolsado_at;
  const concepto = p.es_visita_rapida
    ? "Visita"
    : (conceptoLabels[p.concepto] ?? p.concepto);
  const metodo = metodoLabels[p.metodo_pago ?? ""] ?? p.metodo_pago;
  const estado = p.anulado_at ? (
    <Badge variant="danger">Anulado</Badge>
  ) : p.reembolsado_at ? (
    <Badge variant="warning">Reembolsado</Badge>
  ) : null;

  return (
    <tr
      className={cn(
        "transition-colors hover:bg-surface-hover",
        inactivo && "opacity-50"
      )}
    >
      <Td>
        <span className="font-mono text-dato tabular-nums text-text-secondary">
          {hora(p.fecha_pago)}
        </span>
      </Td>
      <Td>
        {p.es_visita_rapida ? (
          <span className="block truncate text-[15px] leading-5 text-text-primary">
            {p.nombre_visitante ?? "Visitante"}
          </span>
        ) : p.miembro_id && p.miembro_nombre ? (
          <Link
            href={`/${slug}/miembros/${p.miembro_id}`}
            className="block truncate text-[15px] leading-5 text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
          >
            {p.miembro_nombre}
          </Link>
        ) : (
          <span className="block truncate text-[15px] leading-5 text-text-secondary">
            Sin miembro
          </span>
        )}
        <span className="block text-sm text-text-muted md:hidden">
          {concepto} · {metodo}
        </span>
      </Td>
      <Td className="hidden md:table-cell">
        <span className="flex items-center gap-2 text-sm text-text-secondary">
          {concepto}
          {estado}
        </span>
      </Td>
      <Td className="hidden md:table-cell">
        <span className="text-sm text-text-secondary">{metodo}</span>
      </Td>
      <Td className="text-right">
        <Link
          href={`/${slug}/recibos/${p.id}`}
          title="Ver recibo"
          className={cn(
            "font-mono text-dato tabular-nums underline-offset-4 hover:text-brand-green hover:underline",
            inactivo ? "text-text-muted line-through" : "text-text-primary"
          )}
        >
          {formatMoneda(p.monto)}
        </Link>
      </Td>
    </tr>
  );
}
