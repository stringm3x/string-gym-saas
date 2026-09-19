"use client";

import { useState } from "react";
import { LuCircleCheck } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { CuotaPendiente } from "@/lib/types/creditos";
import { CobroCuotaModal } from "./CobroCuotaModal";
import { money } from "@/lib/utils/creditos-calc";

function fecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function textoDias(dias: number): string {
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoy";
  return `Vence en ${dias} día${dias === 1 ? "" : "s"}`;
}

/** Cuotas pendientes: la fecha en mono a la izquierda (danger si venció),
 * miembro y concepto, monto en mono y botón "Cobrar". Sin fondos llenos. */
export function CxCList({ cuotas }: { cuotas: CuotaPendiente[] }) {
  const [cobrando, setCobrando] = useState<CuotaPendiente | null>(null);

  if (cuotas.length === 0) {
    return (
      <EmptyState
        icon={<LuCircleCheck />}
        title="Sin cuotas pendientes"
        description="Nada por cobrar con este filtro. Cuando vendas a crédito, cada cuota aparece aquí con su fecha."
      />
    );
  }

  return (
    <>
      <ul className="card-surface divide-y divide-border">
        {cuotas.map((c) => {
          const vencida = c.estado_calc === "vencida";
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  className={cn(
                    "w-[76px] shrink-0 font-mono text-dato tabular-nums",
                    vencida ? "text-danger" : "text-text-secondary"
                  )}
                >
                  {fecha(c.fecha_vencimiento)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] leading-5 text-text-primary">
                    {c.miembro_nombre ?? "—"}
                    <span className="ml-2 text-sm text-text-muted">
                      Cuota {c.numero_cuota}
                      {c.plan_concepto ? ` · ${c.plan_concepto}` : ""}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      vencida ? "text-danger" : "text-text-muted"
                    )}
                  >
                    {textoDias(c.dias_para_vencer)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-dato tabular-nums text-text-primary">
                  {money(c.monto)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCobrando(c)}
                >
                  Cobrar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {cobrando && (
        <CobroCuotaModal
          open
          onClose={() => setCobrando(null)}
          cuotaId={cobrando.id}
          numeroCuota={cobrando.numero_cuota}
          monto={cobrando.monto}
          miembroNombre={cobrando.miembro_nombre ?? "—"}
        />
      )}
    </>
  );
}
