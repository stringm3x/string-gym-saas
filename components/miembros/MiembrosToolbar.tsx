"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LuSearch } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";

type Filter = "all" | "activos" | "inactivos" | "por_vencer";

const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "inactivos", label: "Inactivos" },
];

const DEBOUNCE_MS = 300;

export function MiembrosToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentFilter = (searchParams.get("filter") as Filter) ?? "all";
  const currentSearch = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Debounce de la búsqueda
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

  function setFilter(filter: Filter) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {filterOptions.map((opt) => {
          const active = currentFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
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
  );
}
