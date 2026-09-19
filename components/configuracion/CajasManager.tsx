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
    <div className="space-y-6">
      <div className="flex items-end gap-3">
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

      <ul className="divide-y divide-border border border-border bg-surface">
        {activas.map((c) => (
          <CajaRow key={c.id} caja={c} />
        ))}
      </ul>

      {inactivas.length > 0 && (
        <div className="space-y-3 border-t border-border pt-6">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            Desactivadas
          </p>
          <ul className="divide-y divide-border border border-border bg-surface">
            {inactivas.map((c) => (
              <CajaRow key={c.id} caja={c} />
            ))}
          </ul>
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
    <li
      className={`flex items-center gap-4 px-5 py-4 ${
        !caja.activa ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nombre}
              aria-label="Nombre de la caja"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
                if (e.key === "Escape") {
                  setEditando(false);
                  setNombre(caja.nombre);
                }
              }}
              className="h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            />
            <button
              type="button"
              onClick={guardar}
              disabled={isPending}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-brand-green disabled:opacity-40"
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-danger disabled:opacity-40"
              aria-label="Cancelar"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {caja.nombre}
              </span>
              {caja.es_default && <Badge variant="info">Principal</Badge>}
              {!caja.activa && <Badge variant="neutral">Desactivada</Badge>}
            </div>
            {caja.activa && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={caja.requiere_cuadre}
                  onChange={(e) => toggleCuadre(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-border accent-brand-green"
                />
                Cuadra su propio efectivo (fondo + conteo al cerrar turno)
              </label>
            )}
          </div>
        )}
      </div>

      {!editando && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditando(true)}
            disabled={isPending}
            aria-label={`Renombrar ${caja.nombre}`}
          >
            <LuPencil className="h-4 w-4" />
          </Button>
          {!caja.es_default && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggle}
              disabled={isPending}
            >
              {caja.activa ? "Desactivar" : "Reactivar"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
