"use client";

import { useState } from "react";
import { LuPlus, LuChevronDown, LuCalendarDays } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Clases recurrentes y únicas de tu gimnasio.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          leftIcon={<LuPlus className="h-4 w-4" />}
        >
          Nueva clase
        </Button>
      </div>

      {clases.length === 0 ? (
        <EmptyState ilustracion="tablero"
          icon={<LuCalendarDays />}
          title="Sin clases todavía"
          description="Crea la primera con su horario y cupo; a partir de ahí se generan las sesiones que tus miembros pueden reservar."
          action={
            <Button
              type="button"
              onClick={openCreate}
              leftIcon={<LuPlus className="h-4 w-4" />}
            >
              Crear primera clase
            </Button>
          }
        />
      ) : (
        <>
          {activas.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-etiqueta uppercase text-text-muted">
                Activas · {activas.length}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
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
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowInactivas((v) => !v)}
                aria-expanded={showInactivas}
                className="inline-flex h-9 items-center gap-1.5 self-start font-mono text-etiqueta uppercase text-text-muted transition-colors hover:text-text-primary"
              >
                <LuChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    !showInactivas && "-rotate-90"
                  )}
                  aria-hidden="true"
                />
                Inactivas · {inactivas.length}
              </button>
              {showInactivas && (
                <div className="grid gap-4 md:grid-cols-2">
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
