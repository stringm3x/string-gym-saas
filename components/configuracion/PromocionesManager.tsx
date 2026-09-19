"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { LuPencil, LuPlus, LuTag } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda, formatFecha } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Promocion } from "@/lib/queries/promociones.queries";
import {
  createPromocionAction,
  updatePromocionAction,
  togglePromocionAction,
  type PromocionFormState,
} from "@/app/(tenant)/[slug]/configuracion/promociones/actions";

interface PromocionesManagerProps {
  promociones: Promocion[];
}

const initial: PromocionFormState = { ok: false, error: null, fieldErrors: {} };

type Modal = { mode: "create" } | { mode: "edit"; promo: Promocion } | null;

export function PromocionesManager({ promociones }: PromocionesManagerProps) {
  const [modal, setModal] = useState<Modal>(null);
  const [modalKey, setModalKey] = useState(0);

  function openModal(m: Exclude<Modal, null>) {
    setModal(m);
    setModalKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Promociones
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {promociones.length === 0
              ? "Sin promociones"
              : `${promociones.length} ${
                  promociones.length === 1 ? "promoción" : "promociones"
                }`}
          </p>
        </div>
        <Button
          leftIcon={<LuPlus className="h-4 w-4" />}
          onClick={() => openModal({ mode: "create" })}
        >
          Nueva promoción
        </Button>
      </div>

      {promociones.length === 0 ? (
        <EmptyState
          icon={<LuTag />}
          title="Sin promociones todavía"
          description="Crea promociones de membresías o productos con vigencia y precio especial; en caja se aplican con un clic."
          action={
            <Button
              leftIcon={<LuPlus className="h-4 w-4" />}
              onClick={() => openModal({ mode: "create" })}
            >
              Crear primera promoción
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border border-border bg-surface">
          {promociones.map((p) => (
            <PromoRow
              key={p.id}
              promo={p}
              onEdit={() => openModal({ mode: "edit", promo: p })}
            />
          ))}
        </ul>
      )}

      <PromoFormModal key={modalKey} modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function PromoRow({ promo, onEdit }: { promo: Promocion; onEdit: () => void }) {
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await togglePromocionAction(promo.id, !promo.activo);
      if (r.ok) {
        success(promo.activo ? "Promoción archivada" : "Promoción activada");
      } else {
        error("No se pudo actualizar", r.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-text-primary">
            {promo.nombre}
          </p>
          <Badge variant={promo.tipo === "membresia" ? "success" : "info"}>
            {promo.tipo === "membresia" ? "Membresía" : "Producto"}
          </Badge>
          {!promo.activo && <Badge variant="neutral">Archivada</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {promo.tipo === "membresia" && promo.dias_duracion && (
            <>
              {promo.dias_duracion}{" "}
              {promo.dias_duracion === 1 ? "día" : "días"} ·{" "}
            </>
          )}
          {promo.vigencia_desde || promo.vigencia_hasta ? (
            <>
              Vigencia:{" "}
              <span className="font-mono tabular-nums">
                {formatFecha(promo.vigencia_desde) ?? "—"} →{" "}
                {formatFecha(promo.vigencia_hasta) ?? "—"}
              </span>
            </>
          ) : (
            "Sin fecha de vigencia"
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-dato font-bold tabular-nums text-text-primary">
          {formatMoneda(promo.precio)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          disabled={isPending}
          className={cn(!promo.activo && "text-brand-green")}
        >
          {promo.activo ? "Archivar" : "Activar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Editar ${promo.nombre}`}
        >
          <LuPencil className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function PromoFormModal({
  modal,
  onClose,
}: {
  modal: Modal;
  onClose: () => void;
}) {
  const { success } = useToast();
  const promo = modal?.mode === "edit" ? modal.promo : undefined;
  const [tipo, setTipo] = useState<"membresia" | "producto">(
    promo?.tipo ?? "membresia"
  );

  // Reset tipo al cambiar de modal
  useEffect(() => {
    if (modal) {
      setTipo(modal.mode === "edit" ? modal.promo.tipo : "membresia");
    }
  }, [modal]);

  const action =
    modal?.mode === "edit"
      ? updatePromocionAction.bind(null, modal.promo.id)
      : createPromocionAction;

  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) {
      success(
        modal?.mode === "edit" ? "Promoción actualizada" : "Promoción creada"
      );
      onClose();
    }
  }, [state, modal, success, onClose]);

  if (!modal) return null;

  return (
    <Modal
      open={!!modal}
      onClose={onClose}
      title={modal.mode === "edit" ? "Editar promoción" : "Nueva promoción"}
      description="Las promociones aparecen como atajos en la pantalla de Caja para cobrar más rápido."
    >
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["membresia", "producto"] as const).map((t) => {
              const active = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={active}
                  className={cn(
                    "h-11 border px-3 text-sm font-semibold transition-colors duration-150",
                    active
                      ? "border-brand-green bg-surface-hover text-brand-green"
                      : "border-border bg-transparent text-text-secondary hover:border-text-secondary hover:text-text-primary"
                  )}
                >
                  {t === "membresia" ? "Membresía" : "Producto"}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="tipo" value={tipo} />
        </div>

        <Input
          label="Nombre"
          name="nombre"
          required
          defaultValue={promo?.nombre}
          placeholder={
            tipo === "membresia"
              ? "Ej. Promo de verano"
              : "Ej. 2x1 en proteínas"
          }
          error={state.fieldErrors.nombre}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio"
            name="precio"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            required
            leftSlot="$"
            defaultValue={promo?.precio}
            error={state.fieldErrors.precio}
          />
          {tipo === "membresia" && (
            <Input
              label="Duración (días)"
              name="dias_duracion"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              required
              defaultValue={promo?.dias_duracion ?? 30}
              error={state.fieldErrors.dias_duracion}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Vigencia desde"
            name="vigencia_desde"
            type="date"
            defaultValue={promo?.vigencia_desde ?? ""}
            description="Opcional"
            error={state.fieldErrors.vigencia_desde}
          />
          <Input
            label="Vigencia hasta"
            name="vigencia_hasta"
            type="date"
            defaultValue={promo?.vigencia_hasta ?? ""}
            description="Opcional"
            error={state.fieldErrors.vigencia_hasta}
          />
        </div>

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {modal.mode === "edit" ? "Guardar" : "Crear promoción"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
