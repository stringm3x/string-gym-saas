"use client";

import { useState } from "react";
import { LuChevronDown, LuCopy, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import type { ValidationError } from "@/lib/types/import";

/** Errores del CSV agrupados por razón: borde danger (sin fondo lleno),
 * filas de 44px, número de fila en mono. */
export function ImportErrorsList({ errors }: { errors: ValidationError[] }) {
  const { success } = useToast();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  if (errors.length === 0) return null;

  // Agrupar por razón.
  const groups = new Map<string, ValidationError[]>();
  for (const e of errors) {
    const list = groups.get(e.reason) ?? [];
    list.push(e);
    groups.set(e.reason, list);
  }

  function copiar() {
    const text = errors
      .map((e) => `Fila ${e.row} · ${e.field || "—"}: ${e.reason}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    success("Errores copiados", "Pégalos en tu hoja de cálculo para corregir.");
  }

  return (
    <section className="border border-danger/40 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 text-[15px] leading-5 text-text-primary">
          <LuTriangleAlert className="h-4 w-4 text-danger" aria-hidden="true" />
          {errors.length} {errors.length === 1 ? "error" : "errores"}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copiar}
          leftIcon={<LuCopy className="h-4 w-4" />}
        >
          Copiar errores
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {Array.from(groups.entries()).map(([reason, list]) => {
          const open = openGroup === reason;
          return (
            <li key={reason}>
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : reason)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="text-[15px] leading-5 text-text-primary">
                  <span className="font-mono text-dato text-text-muted">
                    {list.length}×
                  </span>{" "}
                  {reason}
                </span>
                <LuChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-text-muted transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
              {open && (
                <ul className="border-t border-border bg-bg px-5 py-3 text-sm text-text-secondary">
                  {list.map((e, i) => (
                    <li key={i} className="flex gap-2 py-0.5">
                      <span className="font-mono text-dato text-text-muted">
                        Fila {e.row}
                      </span>
                      {e.field && (
                        <span className="text-text-muted">· {e.field}</span>
                      )}
                      {e.value && <span className="truncate">«{e.value}»</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
