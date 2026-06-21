"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LuSearch } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";
import { hasFeature, type Plan } from "@/lib/features";
import type { Tag } from "@/lib/queries/tags.queries";

/** Estado unificado: combina el filtro de membresía con el de archivado. */
type Estado = "all" | "activos" | "por_vencer" | "inactivos" | "archivados";

const estadoOptions: { value: Estado; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "inactivos", label: "Inactivos" },
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

  const currentSearch = searchParams.get("q") ?? "";
  const currentTag = searchParams.get("tag") ?? "";
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
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function setTagFilter(tagId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!tagId) {
      params.delete("tag");
    } else {
      params.set("tag", tagId);
    }
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Tag:</span>
            <select
              value={currentTag}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-brand-green focus:outline-none"
            >
              <option value="">Todos los tags</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.nombre}
                </option>
              ))}
            </select>
            {currentTag && (
              <button
                type="button"
                onClick={() => setTagFilter("")}
                className="text-xs text-text-muted underline hover:text-text-primary"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
