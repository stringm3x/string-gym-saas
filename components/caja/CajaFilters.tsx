"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";

const options = [
  { value: "all", label: "Todo" },
  { value: "membresia", label: "Membresías" },
  { value: "producto", label: "Productos" },
  { value: "otros", label: "Otros" },
] as const;

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
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => set(opt.value)}
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
  );
}
