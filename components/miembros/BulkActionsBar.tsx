"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuX,
  LuMessageCircle,
  LuTag,
  LuDownload,
  LuLoader,
} from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { compilarPlantilla } from "@/lib/utils/plantilla";
import { formatFecha } from "@/lib/utils/format";
import { bulkAsignarTagAction } from "@/app/(tenant)/[slug]/miembros/actions";
import type { MiembroConTags } from "@/lib/queries/miembros.queries";
import type { Tag } from "@/lib/queries/tags.queries";
import type { PlantillaMensaje } from "@/lib/queries/plantillas.queries";

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  miembros: MiembroConTags[];
  availableTags: Tag[];
  plantillas: PlantillaMensaje[];
  onDeselect: () => void;
  canBulk?: boolean;
  canTags?: boolean;
}

export function BulkActionsBar({
  selectedIds,
  miembros,
  availableTags,
  plantillas,
  onDeselect,
  canBulk = true,
  canTags = true,
}: BulkActionsBarProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [assigningTag, setAssigningTag] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedMiembros = miembros.filter((m) => selectedIds.has(m.id));
  const selectedPlantilla =
    plantillas.find((p) => p.id === selectedPlantillaId) ?? null;

  function exportCSV() {
    const headers = [
      "Nombre",
      "Teléfono",
      "Email",
      "Inscripción",
      "Vencimiento",
      "Estado",
    ];
    const rows = selectedMiembros.map((m) => [
      m.nombre,
      m.telefono ?? "",
      m.email ?? "",
      m.fecha_inscripcion,
      m.fecha_vencimiento ?? "",
      m.estado,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miembros-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleAsignarTag(tagId: string) {
    setTagDropdownOpen(false);
    setAssigningTag(true);
    const result = await bulkAsignarTagAction(Array.from(selectedIds), tagId);
    setAssigningTag(false);
    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudo asignar el tag.");
    } else {
      success(
        `Tag asignado a ${count} miembro${count !== 1 ? "s" : ""}`
      );
      router.refresh();
    }
  }

  return (
    <>
      {/* Barra flotante */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg shadow-black/20">
          <span className="whitespace-nowrap text-sm font-medium text-text-primary">
            {count} seleccionado{count !== 1 ? "s" : ""}
          </span>

          <div className="h-4 w-px bg-border" />

          {/* WhatsApp masivo */}
          {canBulk && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<LuMessageCircle className="h-4 w-4" />}
              onClick={() => setWaModalOpen(true)}
            >
              WhatsApp
            </Button>
          )}

          {/* Asignar tag */}
          {canTags && (
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={
                assigningTag ? (
                  <LuLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LuTag className="h-4 w-4" />
                )
              }
              onClick={() => setTagDropdownOpen((p) => !p)}
              disabled={assigningTag || availableTags.length === 0}
            >
              Asignar tag
            </Button>

            {tagDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTagDropdownOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[160px] rounded-lg border border-border bg-surface py-1 shadow-lg">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAsignarTag(tag.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.nombre}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          {/* Exportar CSV */}
          {canBulk && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<LuDownload className="h-4 w-4" />}
              onClick={exportCSV}
            >
              CSV
            </Button>
          )}

          <div className="h-4 w-px bg-border" />

          {/* Deseleccionar */}
          <button
            type="button"
            onClick={onDeselect}
            className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
            aria-label="Deseleccionar todo"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal WhatsApp masivo */}
      <Modal
        open={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        title={`WhatsApp · ${count} miembro${count !== 1 ? "s" : ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="plantilla-bulk"
              className="text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Plantilla (opcional)
            </label>
            <select
              id="plantilla-bulk"
              value={selectedPlantillaId}
              onChange={(e) => setSelectedPlantillaId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            >
              <option value="">Sin plantilla</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
            {selectedMiembros.map((m) => {
              const msg = selectedPlantilla
                ? compilarPlantilla(selectedPlantilla.contenido, {
                    nombre: m.nombre,
                    fecha_vencimiento: m.fecha_vencimiento
                      ? formatFecha(m.fecha_vencimiento)
                      : undefined,
                  })
                : "";
              const tel = m.telefono?.replace(/\D/g, "");
              const waUrl = tel
                ? `https://wa.me/${tel}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`
                : null;

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {m.nombre}
                    </p>
                    {m.telefono ? (
                      <p className="font-mono text-xs text-text-muted">
                        {m.telefono}
                      </p>
                    ) : (
                      <p className="text-xs text-danger">Sin teléfono</p>
                    )}
                  </div>
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/20"
                    >
                      Abrir
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-text-muted">
                      Sin teléfono
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-text-muted">
            Cada chat se abre por separado en WhatsApp.
          </p>
        </div>
      </Modal>
    </>
  );
}
