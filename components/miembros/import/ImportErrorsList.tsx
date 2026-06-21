"use client";

import { useState } from "react";
import { LuChevronDown, LuCopy, LuTriangleAlert } from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import type { ValidationError } from "@/lib/types/import";

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
    success("Errores copiados", "Pégalo en Excel para corregir.");
  }

  return (
    <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <LuTriangleAlert className="h-4 w-4 text-danger" />
          {errors.length} {errors.length === 1 ? "error" : "errores"} encontrados
        </p>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <LuCopy className="h-3.5 w-3.5" />
          Copiar errores
        </button>
      </div>

      <div className="space-y-1.5">
        {Array.from(groups.entries()).map(([reason, list]) => {
          const open = openGroup === reason;
          return (
            <div
              key={reason}
              className="rounded-lg border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : reason)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
              >
                <span className="text-text-primary">
                  <span className="font-mono text-text-muted">
                    {list.length}×
                  </span>{" "}
                  {reason}
                </span>
                <LuChevronDown
                  className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open && (
                <div className="border-t border-border px-3 py-2">
                  <ul className="space-y-1 text-xs text-text-secondary">
                    {list.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-text-muted">
                          Fila {e.row}
                        </span>
                        {e.field && (
                          <span className="text-text-muted">· {e.field}</span>
                        )}
                        {e.value && (
                          <span className="truncate">«{e.value}»</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
