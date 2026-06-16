"use client";

import { useState, useCallback } from "react";
import { MiembrosTable } from "./MiembrosTable";
import { BulkActionsBar } from "./BulkActionsBar";
import type { MiembroConTags } from "@/lib/queries/miembros.queries";
import type { Tag } from "@/lib/queries/tags.queries";
import type { PlantillaMensaje } from "@/lib/queries/plantillas.queries";

interface MiembrosListClientProps {
  miembros: MiembroConTags[];
  slug: string;
  availableTags: Tag[];
  plantillas: PlantillaMensaje[];
  soloArchivados?: boolean;
}

export function MiembrosListClient({
  miembros,
  slug,
  availableTags,
  plantillas,
  soloArchivados = false,
}: MiembrosListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected =
    miembros.length > 0 && miembros.every((m) => selectedIds.has(m.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(miembros.map((m) => m.id)));
    }
  }, [allSelected, miembros]);

  const deselect = useCallback(() => setSelectedIds(new Set()), []);

  return (
    <>
      <MiembrosTable
        miembros={miembros}
        slug={slug}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        soloArchivados={soloArchivados}
      />
      <BulkActionsBar
        selectedIds={selectedIds}
        miembros={miembros}
        availableTags={availableTags}
        plantillas={plantillas}
        onDeselect={deselect}
      />
    </>
  );
}
