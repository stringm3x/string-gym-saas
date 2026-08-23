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
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
          {estadoOptions.map((opt) => {
            const active = currentEstado === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEstado(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  active
                    ? "bg-bg text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
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
          <span className="text-xs text-text-muted">Origen:</span>
          <select
            value={currentOrigen}
            onChange={(e) => setOrigen(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-brand-green focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="manual">Creados manualmente</option>
            <option value="csv">Importados (CSV)</option>
          </select>
        </div>

        {canTags && availableTags.length > 0 && (
          <div className="relative flex items-center gap-2">
            <span className="text-xs text-text-muted">Tags:</span>
            <button
              type="button"
              onClick={() => setTagsOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors duration-150",
                currentTags.length > 0
                  ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
                  : "border-border bg-surface text-text-primary hover:border-text-muted"
              )}
            >
              {currentTags.length === 0
                ? "Todos los tags"
                : `${currentTags.length} seleccionado${currentTags.length === 1 ? "" : "s"}`}
              <LuChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  tagsOpen && "rotate-180"
                )}
              />
            </button>
            {currentTags.length > 0 && (
              <button
                type="button"
                onClick={clearTags}
                className="text-xs text-text-muted underline hover:text-text-primary"
              >
                Limpiar
              </button>
            )}

            {tagsOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTagsOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-border bg-surface p-1 shadow-lg">
                  {availableTags.map((tag) => {
                    const checked = currentTags.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-primary hover:bg-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTag(tag.id)}
                          className="h-3.5 w-3.5 rounded border-border accent-brand-green"
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
