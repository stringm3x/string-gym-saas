"use client";

import Link from "next/link";
import { formatFecha } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { MiembroStatusBadge } from "./MiembroStatusBadge";
import { TagBadges } from "@/components/ui/TagSelector";
import { Badge } from "@/components/ui/Badge";
import type { MiembroConTags } from "@/lib/queries/miembros.queries";

interface MiembrosTableProps {
  miembros: MiembroConTags[];
  slug: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  soloArchivados?: boolean;
  selectable?: boolean;
}

/**
 * Tabla de miembros: encabezados en mono, fechas y teléfono en mono,
 * fila seleccionada con fondo lleno (sin verde). Filas de 44px.
 */
export function MiembrosTable({
  miembros,
  slug,
  selectedIds,
  onToggleSelect,
  allSelected,
  onToggleAll,
  soloArchivados = false,
  selectable = true,
}: MiembrosTableProps) {
  return (
    <div className="card-surface overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-border">
            {selectable && (
              <th scope="col" className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-border accent-brand-green"
                  aria-label="Seleccionar todos"
                />
              </th>
            )}
            <Th>Miembro</Th>
            <Th>Contacto</Th>
            <Th>Inscripción</Th>
            <Th>Vencimiento</Th>
            <Th>Estado</Th>
            <Th>Tags</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {miembros.map((m) => (
            <tr
              key={m.id}
              className={cn(
                "group transition-colors duration-150",
                selectedIds.has(m.id) ? "bg-surface-hover" : "hover:bg-surface-hover",
                soloArchivados && "opacity-60"
              )}
            >
              {selectable && (
                <td className="w-12 px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => onToggleSelect(m.id)}
                    className="h-4 w-4 rounded border-border accent-brand-green"
                    aria-label={`Seleccionar ${m.nombre}`}
                  />
                </td>
              )}

              <Td>
                <Link
                  href={`/${slug}/miembros/${m.id}`}
                  className="inline-flex min-h-11 items-center gap-2 text-[15px] leading-5 text-text-primary underline-offset-4 hover:text-brand-green hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                >
                  {m.nombre}
                  {soloArchivados && <Badge variant="neutral">Archivado</Badge>}
                </Link>
              </Td>

              <Td>
                <div className="flex flex-col gap-0.5 text-sm text-text-secondary">
                  {m.telefono && (
                    <span className="font-mono text-dato">{m.telefono}</span>
                  )}
                  {m.email && <span className="truncate">{m.email}</span>}
                </div>
              </Td>

              <Td>
                <span className="font-mono text-dato tabular-nums text-text-secondary">
                  {formatFecha(m.fecha_inscripcion)}
                </span>
              </Td>

              <Td>
                <span className="font-mono text-dato tabular-nums text-text-secondary">
                  {formatFecha(m.fecha_vencimiento)}
                </span>
              </Td>

              <Td>
                <MiembroStatusBadge
                  fechaVencimiento={m.fecha_vencimiento}
                  visitasRestantes={m.visitas_restantes}
                />
              </Td>

              <Td>
                <TagBadges tags={m.tags} max={3} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left font-mono text-etiqueta font-normal uppercase text-text-muted"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 align-middle">{children}</td>;
}
