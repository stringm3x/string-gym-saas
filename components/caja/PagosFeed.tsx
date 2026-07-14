import Link from "next/link";
import { LuWallet, LuReceipt } from "react-icons/lu";
import { formatMoneda, formatFechaHora } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
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

export function PagosFeed({ pagos, slug }: PagosFeedProps) {
  if (pagos.length === 0) {
    return (
      <EmptyState
        icon={<LuWallet className="h-5 w-5" />}
        title="Sin pagos hoy"
        description="Cuando registres el primer cobro del día, aparecerá aquí."
      />
    );
  }

  const entries = agrupar(pagos);

  return (
    <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-xl border border-border bg-surface">
      {entries.map((e) =>
        e.kind === "ticket" ? (
          <TicketRow key={e.ticketId} entry={e} slug={slug} />
        ) : (
          <PagoRow key={e.pago.id} pago={e.pago} slug={slug} />
        )
      )}
    </ul>
  );
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
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <Badge variant="info" className="shrink-0">
          Ticket
        </Badge>
        <div className="min-w-0">
          {first.miembro_id && first.miembro_nombre ? (
            <Link
              href={`/${slug}/miembros/${first.miembro_id}`}
              className="truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-green"
            >
              {first.miembro_nombre}
            </Link>
          ) : (
            <p className="truncate text-sm font-medium text-text-primary">
              {entry.lineas.length}{" "}
              {entry.lineas.length === 1 ? "artículo" : "artículos"}
            </p>
          )}
          <p className="text-xs text-text-muted">
            {formatFechaHora(first.fecha_pago)} · {first.metodo_pago} ·{" "}
            {entry.lineas.length}{" "}
            {entry.lineas.length === 1 ? "línea" : "líneas"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
          {formatMoneda(total)}
        </span>
        <Link
          href={`/${slug}/recibos/ticket/${entry.ticketId}`}
          title="Ver ticket"
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <LuReceipt className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function PagoRow({ pago: p, slug }: { pago: PagoConMiembro; slug: string }) {
  const inactivo = !!p.anulado_at || !!p.reembolsado_at;
  return (
    <li
      className={`flex items-center justify-between gap-4 px-4 py-4 ${
        inactivo ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <Badge
          variant={p.es_visita_rapida ? "info" : "neutral"}
          className="shrink-0"
        >
          {p.es_visita_rapida
            ? "Visita"
            : (conceptoLabels[p.concepto] ?? p.concepto)}
        </Badge>
        <div className="min-w-0">
          {p.es_visita_rapida ? (
            <p className="truncate text-sm font-medium text-text-primary">
              {p.nombre_visitante ?? "Visitante"}
            </p>
          ) : p.miembro_id && p.miembro_nombre ? (
            <Link
              href={`/${slug}/miembros/${p.miembro_id}`}
              className="truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-green"
            >
              {p.miembro_nombre}
            </Link>
          ) : (
            <p className="truncate text-sm text-text-secondary">Sin miembro</p>
          )}
          <p className="text-xs text-text-muted">
            {formatFechaHora(p.fecha_pago)} · {p.metodo_pago}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {p.anulado_at && <Badge variant="danger">Anulado</Badge>}
        {!p.anulado_at && p.reembolsado_at && (
          <Badge variant="warning">Reembolsado</Badge>
        )}
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            inactivo ? "text-text-muted line-through" : "text-text-primary"
          }`}
        >
          {formatMoneda(p.monto)}
        </span>
        <Link
          href={`/${slug}/recibos/${p.id}`}
          title="Ver recibo"
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <LuReceipt className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}
