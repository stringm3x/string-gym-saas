"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";

const options = [
  { value: "all", label: "Todo" },
  { value: "membresia", label: "Membresías" },
  { value: "producto", label: "Productos" },
  { value: "visitas", label: "Visitas" },
  { value: "otros", label: "Otros" },
] as const;

/** Filtro por categoría de los movimientos: chips con estado seleccionado
 * en fondo lleno + ácido (sin barra lateral). */
export function CajaFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("cat") ?? "all";

  function set(cat: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === "all") params.delete("cat");
    else params.set("cat", cat);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => set(opt.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 items-center border px-3 text-sm transition-colors duration-150",
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
  );
}
