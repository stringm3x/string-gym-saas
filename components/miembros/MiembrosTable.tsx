"use client";

import Link from "next/link";
import { LuPhone, LuMail } from "react-icons/lu";
import { formatFecha } from "@/lib/utils/format";
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
}

export function MiembrosTable({
  miembros,
  slug,
  selectedIds,
  onToggleSelect,
  allSelected,
  onToggleAll,
  soloArchivados = false,
}: MiembrosTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th scope="col" className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="rounded border-border accent-brand-green"
                aria-label="Seleccionar todos"
              />
            </th>
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
              className={`group transition-colors duration-150 ${
                selectedIds.has(m.id)
                  ? "bg-brand-green/5"
                  : "hover:bg-surface-hover"
              } ${soloArchivados ? "opacity-60" : ""}`}
            >
              <td className="w-10 px-4 py-3 align-middle">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => onToggleSelect(m.id)}
                  className="rounded border-border accent-brand-green"
                  aria-label={`Seleccionar ${m.nombre}`}
                />
              </td>

              <Td>
                <Link
                  href={`/${slug}/miembros/${m.id}`}
                  className="inline-flex items-center gap-2 font-medium text-text-primary group-hover:text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                >
                  {m.nombre}
                  {soloArchivados && <Badge variant="neutral">Archivado</Badge>}
                </Link>
              </Td>

              <Td>
                <div className="flex flex-col gap-0.5 text-xs text-text-secondary">
                  {m.telefono && (
                    <span className="flex items-center gap-1.5">
                      <LuPhone className="h-3 w-3" aria-hidden="true" />
                      <span className="font-mono">{m.telefono}</span>
                    </span>
                  )}
                  {m.email && (
                    <span className="flex items-center gap-1.5">
                      <LuMail className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{m.email}</span>
                    </span>
                  )}
                </div>
              </Td>

              <Td>
                <span className="font-mono text-xs text-text-secondary">
                  {formatFecha(m.fecha_inscripcion)}
                </span>
              </Td>

              <Td>
                <span className="font-mono text-xs text-text-secondary">
                  {formatFecha(m.fecha_vencimiento)}
                </span>
              </Td>

              <Td>
                <MiembroStatusBadge fechaVencimiento={m.fecha_vencimiento} />
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
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
