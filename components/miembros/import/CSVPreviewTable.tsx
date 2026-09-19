"use client";

import { Fragment, useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import { formatFecha } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { PreviewRow, PlanMatch } from "@/lib/types/import";

function PlanBadge({ plan }: { plan: PlanMatch }) {
  if (plan.status === "ok")
    return <Badge variant="success">{plan.planNombre}</Badge>;
  if (plan.status === "sin_plan")
    return <Badge variant="warning">Sin plan</Badge>;
  return <Badge variant="danger">No encontrado: {plan.planNombre}</Badge>;
}

/** Vista previa del CSV: encabezados en mono, fechas y teléfono en mono.
 * El detalle de cada fila se abre con un botón (no con clic en la fila). */
export function CSVPreviewTable({ rows }: { rows: PreviewRow[] }) {
  const visible = rows.slice(0, 20);
  const [expanded, setExpanded] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="border border-border bg-bg px-5 py-8 text-center text-sm text-text-muted">
        No hay filas válidas para previsualizar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-border bg-bg">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <Th>Nombre</Th>
              <Th>Contacto</Th>
              <Th>Vigencia</Th>
              <Th>Plan</Th>
              <Th>Avisos</Th>
              <Th className="w-12">
                <span className="sr-only">Detalle</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => {
              const open = expanded === r.row;
              return (
                <Fragment key={r.row}>
                  <tr className={cn("transition-colors", open && "bg-surface-hover")}>
                    <Td>
                      <span className="text-[15px] leading-5 text-text-primary">
                        {r.data.nombre}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-0.5 text-sm text-text-secondary">
                        {r.data.telefono && (
                          <span className="font-mono text-dato">
                            {r.data.telefono}
                          </span>
                        )}
                        {r.data.email && (
                          <span className="truncate">{r.data.email}</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-dato tabular-nums text-text-secondary">
                        {r.data.fecha_vencimiento
                          ? formatFecha(r.data.fecha_vencimiento)
                          : "—"}
                      </span>
                    </Td>
                    <Td>
                      <PlanBadge plan={r.plan} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.duplicateInCSV && (
                          <Badge variant="warning">Dup. CSV</Badge>
                        )}
                        {r.duplicateInDB && (
                          <Badge variant="info">Ya existe</Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : r.row)}
                        aria-expanded={open}
                        aria-label={`Detalle de la fila ${r.row}`}
                        className="flex h-11 w-11 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <LuChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            open && "rotate-180"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </Td>
                  </tr>
                  {open && (
                    <tr className="bg-surface-hover">
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-sm text-text-secondary"
                      >
                        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                          <span>
                            <span className="text-text-muted">Inscripción:</span>{" "}
                            <span className="font-mono">
                              {r.data.fecha_inscripcion
                                ? formatFecha(r.data.fecha_inscripcion)
                                : "hoy (por defecto)"}
                            </span>
                          </span>
                          <span>
                            <span className="text-text-muted">Fila CSV:</span>{" "}
                            <span className="font-mono">{r.row}</span>
                          </span>
                          {r.data.notas && (
                            <span className="sm:col-span-2">
                              <span className="text-text-muted">Notas:</span>{" "}
                              {r.data.notas}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 20 && (
        <p className="text-sm text-text-muted">
          Mostrando 20 de {rows.length} filas válidas. Todas se importarán.
        </p>
      )}
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
        "px-4 py-3 text-left font-mono text-etiqueta font-normal uppercase text-text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
