"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LuSearch, LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { hasFeature, type Plan } from "@/lib/features";
import type { Tag } from "@/lib/queries/tags.queries";

/** Estado unificado: combina el filtro de membresía con el de archivado. */
type Estado =
  | "all"
  | "activos"
  | "por_vencer"
  | "inactivos"
  | "sin_telefono"
  | "archivados";

const estadoOptions: { value: Estado; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "inactivos", label: "Inactivos" },
  { value: "sin_telefono", label: "Sin teléfono" },
  { value: "archivados", label: "Archivados" },
];

const DEBOUNCE_MS = 300;

interface MiembrosToolbarProps {
  availableTags?: Tag[];
  plan: Plan;
}

export function MiembrosToolbar({ availableTags = [], plan }: MiembrosToolbarProps) {
  const canTags = hasFeature(plan, "tags");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [tagsOpen, setTagsOpen] = useState(false);

  const currentSearch = searchParams.get("q") ?? "";
  const currentTags = (searchParams.get("tags") ?? "")
    .split(",")
    .filter(Boolean);
  const currentOrigen = searchParams.get("origen") ?? "todos";
  // Estado derivado: archivado tiene prioridad; si no, el filtro de membresía.
  const currentEstado: Estado = searchParams.get("archivado") === "true"
    ? "archivados"
    : ((searchParams.get("filter") as Estado) ?? "all");
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    if (searchInput === currentSearch) return;

    const t = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput.trim()) {
        params.set("q", searchInput.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function setEstado(estado: Estado) {
    const params = new URLSearchParams(searchParams.toString());
    if (estado === "archivados") {
      params.set("archivado", "true");
      params.delete("filter");
    } else {
      params.delete("archivado");
      if (estado === "all") params.delete("filter");
      else params.set("filter", estado);
    }
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function toggleTag(tagId: string) {
    const next = currentTags.includes(tagId)
      ? currentTags.filter((t) => t !== tagId)
      : [...currentTags, tagId];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("tags");
    else params.set("tags", next.join(","));
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearTags() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function setOrigen(origen: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (origen === "todos") {
      params.delete("origen");
    } else {
      params.set("origen", origen);
    }
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtro de estado: chip seleccionado en fondo lleno + ácido */}
        <div className="flex flex-wrap items-center gap-2">
          {estadoOptions.map((opt) => {
            const active = currentEstado === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEstado(opt.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-11 items-center border px-3 text-sm transition-colors duration-150",
                  active
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Buscar por nombre, teléfono o correo…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftSlot={<LuSearch className="h-4 w-4" />}
            aria-label="Buscar miembros"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="miembros-origen"
            className="font-mono text-etiqueta uppercase text-text-muted"
          >
            Origen
          </label>
          <select
            id="miembros-origen"
            value={currentOrigen}
            onChange={(e) => setOrigen(e.target.value)}
            className="h-11 rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="manual">Creados a mano</option>
            <option value="csv">Importados (CSV)</option>
          </select>
        </div>

        {canTags && availableTags.length > 0 && (
          <div className="relative flex items-center gap-2">
            <span className="font-mono text-etiqueta uppercase text-text-muted">
              Tags
            </span>
            <button
              type="button"
              onClick={() => setTagsOpen((v) => !v)}
              aria-expanded={tagsOpen}
              className={cn(
                "inline-flex h-11 items-center gap-2 border px-3 text-sm transition-colors duration-150",
                currentTags.length > 0
                  ? "border-brand-green bg-surface-hover text-brand-green"
                  : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
              )}
            >
              {currentTags.length === 0
                ? "Todos los tags"
                : `${currentTags.length} seleccionado${currentTags.length === 1 ? "" : "s"}`}
              <LuChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  tagsOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {currentTags.length > 0 && (
              <button
                type="button"
                onClick={clearTags}
                className="inline-flex h-11 items-center text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
              >
                Limpiar
              </button>
            )}

            {tagsOpen && (
              <>
                <button
                  type="button"
                  aria-label="Cerrar lista de tags"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setTagsOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-2 w-56 border border-border bg-surface">
                  {availableTags.map((tag) => {
                    const checked = currentTags.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTag(tag.id)}
                          className="h-4 w-4 rounded border-border accent-brand-green"
                        />
                        {tag.nombre}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
