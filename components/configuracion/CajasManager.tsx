"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuPencil, LuCheck, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  createCajaAction,
  renameCajaAction,
  desactivarCajaAction,
  reactivarCajaAction,
  toggleRequiereCuadreAction,
} from "@/app/(tenant)/[slug]/configuracion/cajas/actions";
import type { Caja } from "@/lib/queries/cajas.queries";

export function CajasManager({ cajas }: { cajas: Caja[] }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [nombreNueva, setNombreNueva] = useState("");
  const [isPending, startTransition] = useTransition();

  function crear() {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    startTransition(async () => {
      const r = await createCajaAction(nombre);
      if (!r.ok) {
        toastError("No se pudo crear", r.error);
        return;
      }
      success("Caja creada");
      setNombreNueva("");
      router.refresh();
    });
  }

  const activas = cajas.filter((c) => c.activa);
  const inactivas = cajas.filter((c) => !c.activa);

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Nueva caja"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Ej. Aguas, Tienda…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                crear();
              }
            }}
          />
        </div>
        <Button
          leftIcon={<LuPlus className="h-4 w-4" />}
          onClick={crear}
          loading={isPending}
          disabled={!nombreNueva.trim()}
        >
          Crear
        </Button>
      </div>

      <div className="space-y-2">
        {activas.map((c) => (
          <CajaRow key={c.id} caja={c} />
        ))}
      </div>

      {inactivas.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Desactivadas
          </p>
          {inactivas.map((c) => (
            <CajaRow key={c.id} caja={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CajaRow({ caja }: { caja: Caja }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(caja.nombre);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    const limpio = nombre.trim();
    if (!limpio || limpio === caja.nombre) {
      setEditando(false);
      setNombre(caja.nombre);
      return;
    }
    startTransition(async () => {
      const r = await renameCajaAction(caja.id, limpio);
      if (!r.ok) {
        toastError("No se pudo renombrar", r.error);
        return;
      }
      success("Caja renombrada");
      setEditando(false);
      router.refresh();
    });
  }

  function toggle() {
    startTransition(async () => {
      const r = caja.activa
        ? await desactivarCajaAction(caja.id)
        : await reactivarCajaAction(caja.id);
      if (!r.ok) {
        toastError(
          caja.activa ? "No se pudo desactivar" : "No se pudo reactivar",
          r.error
        );
        return;
      }
      success(caja.activa ? "Caja desactivada" : "Caja reactivada");
      router.refresh();
    });
  }

  function toggleCuadre(checked: boolean) {
    startTransition(async () => {
      const r = await toggleRequiereCuadreAction(caja.id, checked);
      if (!r.ok) {
        toastError("No se pudo actualizar", r.error);
        return;
      }
      success(
        checked
          ? "Ahora cuadra su propio efectivo"
          : "Ya no cuadra efectivo por separado"
      );
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 ${
        !caja.activa ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
                if (e.key === "Escape") {
                  setEditando(false);
                  setNombre(caja.nombre);
                }
              }}
              className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            />
            <button
              type="button"
              onClick={guardar}
              disabled={isPending}
              className="text-text-muted hover:text-success disabled:opacity-40"
              aria-label="Guardar"
            >
              <LuCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setNombre(caja.nombre);
              }}
              disabled={isPending}
              className="text-text-muted hover:text-danger disabled:opacity-40"
              aria-label="Cancelar"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {caja.nombre}
              </span>
              {caja.es_default && <Badge variant="info">Default</Badge>}
              {!caja.activa && <Badge variant="neutral">Desactivada</Badge>}
            </div>
            {caja.activa && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={caja.requiere_cuadre}
                  onChange={(e) => toggleCuadre(e.target.checked)}
                  disabled={isPending}
                  className="h-3.5 w-3.5 rounded border-border accent-brand-green"
                />
                Cuadra su propio efectivo (fondo + conteo al cerrar turno)
              </label>
            )}
          </div>
        )}
      </div>

      {!editando && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={isPending}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
            aria-label={`Renombrar ${caja.nombre}`}
          >
            <LuPencil className="h-3.5 w-3.5" />
          </button>
          {!caja.es_default && (
            <button
              type="button"
              onClick={toggle}
              disabled={isPending}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-40"
            >
              {caja.activa ? "Desactivar" : "Reactivar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
