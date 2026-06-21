"use client";

import { Fragment, useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import { formatFecha } from "@/lib/utils/format";
import type { PreviewRow, PlanMatch } from "@/lib/types/import";

function PlanBadge({ plan }: { plan: PlanMatch }) {
  if (plan.status === "ok")
    return <Badge variant="success">{plan.planNombre}</Badge>;
  if (plan.status === "sin_plan")
    return <Badge variant="warning">Sin plan</Badge>;
  return <Badge variant="danger">No encontrado: {plan.planNombre}</Badge>;
}

export function CSVPreviewTable({ rows }: { rows: PreviewRow[] }) {
  const visible = rows.slice(0, 20);
  const [expanded, setExpanded] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-secondary">
        No hay filas válidas para previsualizar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
              <Th>Nombre</Th>
              <Th>Contacto</Th>
              <Th>Vigencia</Th>
              <Th>Plan</Th>
              <Th>Avisos</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <Fragment key={r.row}>
                <tr
                  className="cursor-pointer transition-colors hover:bg-surface-hover"
                  onClick={() =>
                    setExpanded(expanded === r.row ? null : r.row)
                  }
                >
                  <Td>
                    <span className="font-medium text-text-primary">
                      {r.data.nombre}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5 text-xs text-text-secondary">
                      {r.data.telefono && (
                        <span className="font-mono">{r.data.telefono}</span>
                      )}
                      {r.data.email && (
                        <span className="truncate">{r.data.email}</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-text-secondary">
                      {r.data.fecha_vencimiento
                        ? formatFecha(r.data.fecha_vencimiento)
                        : "—"}
                    </span>
                  </Td>
                  <Td>
                    <PlanBadge plan={r.plan} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {r.duplicateInCSV && (
                        <Badge variant="warning">Dup. CSV</Badge>
                      )}
                      {r.duplicateInDB && (
                        <Badge variant="info">Ya existe</Badge>
                      )}
                      <LuChevronDown
                        className={`h-3.5 w-3.5 text-text-muted transition-transform ${
                          expanded === r.row ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </Td>
                </tr>
                {expanded === r.row && (
                  <tr className="bg-bg/40">
                    <td colSpan={5} className="px-4 py-3 text-xs text-text-secondary">
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        <span>
                          <span className="text-text-muted">Inscripción:</span>{" "}
                          {r.data.fecha_inscripcion
                            ? formatFecha(r.data.fecha_inscripcion)
                            : "hoy (default)"}
                        </span>
                        <span>
                          <span className="text-text-muted">Fila CSV:</span>{" "}
                          {r.row}
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
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 20 && (
        <p className="text-xs text-text-muted">
          Mostrando 20 de {rows.length} filas válidas. Todas se importarán.
        </p>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-middle">{children}</td>;
}
