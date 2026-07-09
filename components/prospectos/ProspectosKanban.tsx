"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useToast } from "@/components/ui/Toast";
import { KanbanColumn } from "./KanbanColumn";
import { ProspectoCard } from "./ProspectoCard";
import { ProspectoModal } from "./ProspectoModal";
import { InscribirMiembroModal } from "./InscribirMiembroModal";
import { cambiarEstadoAction } from "@/app/(tenant)/[slug]/prospectos/actions";
import type { ProspectoConTags } from "@/lib/queries/prospectos.queries";
import type { ProspectoEstado } from "@/lib/validations/prospecto.schema";
import type { Tag } from "@/lib/queries/tags.queries";
import type { PlantillaMensaje } from "@/lib/queries/plantillas.queries";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

const COLUMNS: { estado: ProspectoEstado; label: string; colorClass: string }[] = [
  { estado: "nuevo", label: "Nuevo", colorClass: "text-text-secondary" },
  { estado: "contactado", label: "Contactado", colorClass: "text-[var(--color-gold)]" },
  { estado: "agendado", label: "Agendado", colorClass: "text-warning" },
  { estado: "convertido", label: "Convertido", colorClass: "text-brand-green" },
  { estado: "descartado", label: "Descartado", colorClass: "text-text-muted" },
];

type ColumnMap = Record<ProspectoEstado, ProspectoConTags[]>;

function buildColumnMap(prospectos: ProspectoConTags[]): ColumnMap {
  const map: ColumnMap = {
    nuevo: [],
    contactado: [],
    agendado: [],
    convertido: [],
    descartado: [],
  };
  for (const p of prospectos) {
    map[p.estado].push(p);
  }
  return map;
}

interface ProspectosKanbanProps {
  prospectos: ProspectoConTags[];
  slug: string;
  availableTags?: Tag[];
  plantillas?: PlantillaMensaje[];
  planes?: PlanMembresia[];
}

export function ProspectosKanban({ prospectos, slug, availableTags = [], plantillas = [], planes = [] }: ProspectosKanbanProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [columns, setColumns] = useState<ColumnMap>(() =>
    buildColumnMap(prospectos)
  );
  const [selectedProspecto, setSelectedProspecto] = useState<ProspectoConTags | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inscribirProspecto, setInscribirProspecto] =
    useState<ProspectoConTags | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function findProspecto(id: string): ProspectoConTags | undefined {
    for (const col of Object.values(columns)) {
      const found = col.find((p) => p.id === id);
      if (found) return found;
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const prospecto = findProspecto(active.id as string);
    const nuevoEstado = over.id as ProspectoEstado;

    if (!prospecto || prospecto.estado === nuevoEstado) return;

    // Mover a "Convertido" solo cambia el estado; la inscripción se dispara
    // con el botón "Inscribir como miembro" de la card.
    const estadoAnterior = prospecto.estado;

    // Optimistic update
    setColumns((prev) => {
      const next = { ...prev } as ColumnMap;
      next[estadoAnterior] = next[estadoAnterior].filter((p) => p.id !== prospecto.id);
      next[nuevoEstado] = [{ ...prospecto, estado: nuevoEstado }, ...next[nuevoEstado]];
      return next;
    });

    const result = await cambiarEstadoAction(prospecto.id, nuevoEstado);

    if (!result.ok) {
      // Revert
      setColumns((prev) => {
        const next = { ...prev } as ColumnMap;
        next[nuevoEstado] = next[nuevoEstado].filter((p) => p.id !== prospecto.id);
        next[estadoAnterior] = [prospecto, ...next[estadoAnterior]];
        return next;
      });
      toastError("Error", result.error ?? "No se pudo mover el prospecto");
    } else {
      success("Prospecto actualizado");
    }
  }

  const handleCardClick = useCallback((prospecto: ProspectoConTags) => {
    setSelectedProspecto(prospecto);
    setIsCreating(false);
    setIsModalOpen(true);
  }, []);

  function handleNewProspecto() {
    setSelectedProspecto(null);
    setIsCreating(true);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setSelectedProspecto(null);
    setIsCreating(false);
  }

  function handleModalSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleNewProspecto}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          + Nuevo prospecto
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(({ estado, label, colorClass }) => (
            <KanbanColumn
              key={estado}
              estado={estado}
              label={label}
              count={columns[estado].length}
              colorClass={colorClass}
              isConverting={estado === "convertido"}
            >
              {columns[estado].map((prospecto) => (
                <ProspectoCard
                  key={prospecto.id}
                  prospecto={prospecto}
                  onClick={handleCardClick}
                  onInscribir={setInscribirProspecto}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </DndContext>

      <ProspectoModal
        open={isModalOpen}
        onClose={handleModalClose}
        slug={slug}
        prospecto={isCreating ? undefined : selectedProspecto ?? undefined}
        availableTags={availableTags}
        plantillas={plantillas}
        onSuccess={handleModalSuccess}
      />

      {inscribirProspecto && (
        <InscribirMiembroModal
          open={!!inscribirProspecto}
          onClose={() => setInscribirProspecto(null)}
          slug={slug}
          prospecto={inscribirProspecto}
          planes={planes}
        />
      )}
    </>
  );
}
