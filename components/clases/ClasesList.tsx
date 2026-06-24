"use client";

import { useState } from "react";
import { LuPlus, LuChevronDown } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { ClaseCard } from "./ClaseCard";
import { ClaseForm } from "./ClaseForm";
import type { Clase } from "@/lib/types/clases";

export function ClasesList({
  clases,
  slug,
}: {
  clases: Clase[];
  slug: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Clase | null>(null);
  const [showInactivas, setShowInactivas] = useState(false);

  const activas = clases.filter((c) => c.activa);
  const inactivas = clases.filter((c) => !c.activa);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(c: Clase) {
    setEditing(c);
    setModalOpen(true);
  }
  function close() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Clases recurrentes y únicas de tu gimnasio.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-bg hover:bg-brand-green/90"
        >
          <LuPlus className="h-4 w-4" /> Nueva clase
        </button>
      </div>

      {clases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-text-primary">
            Aún no tienes clases configuradas.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Crea tu primera clase para empezar a generar sesiones.
          </p>
        </div>
      ) : (
        <>
          {activas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Activas ({activas.length})
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {activas.map((c) => (
                  <ClaseCard
                    key={c.id}
                    clase={c}
                    slug={slug}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </div>
          )}

          {inactivas.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowInactivas((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
              >
                <LuChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showInactivas ? "" : "-rotate-90"
                  }`}
                />
                Inactivas ({inactivas.length})
              </button>
              {showInactivas && (
                <div className="grid gap-3 md:grid-cols-2">
                  {inactivas.map((c) => (
                    <ClaseCard
                      key={c.id}
                      clase={c}
                      slug={slug}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={close}
        title={editing ? "Editar clase" : "Nueva clase"}
        size="lg"
      >
        <ClaseForm
          mode={editing ? "edit" : "create"}
          initial={editing ?? undefined}
          onDone={close}
        />
      </Modal>
    </div>
  );
}
