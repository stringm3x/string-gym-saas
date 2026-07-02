"use client";

import { useState } from "react";
import { LuTriangleAlert, LuClock } from "react-icons/lu";
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

export function CxCList({ cuotas }: { cuotas: CuotaPendiente[] }) {
  const [cobrando, setCobrando] = useState<CuotaPendiente | null>(null);

  if (cuotas.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-secondary">
        No hay cuotas pendientes con este filtro.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {cuotas.map((c) => {
          const vencida = c.estado_calc === "vencida";
          const Icono = vencida ? LuTriangleAlert : LuClock;
          return (
            <li
              key={c.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                vencida ? "border-danger/30 bg-danger/5" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icono
                  className={`h-4 w-4 shrink-0 ${vencida ? "text-danger" : "text-text-muted"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {c.miembro_nombre ?? "—"}
                    <span className="ml-2 text-xs font-normal text-text-secondary">
                      Cuota {c.numero_cuota}
                      {c.plan_concepto ? ` · ${c.plan_concepto}` : ""}
                    </span>
                  </p>
                  <p
                    className={`text-xs ${vencida ? "text-danger" : "text-text-secondary"}`}
                  >
                    {textoDias(c.dias_para_vencer)} · {fecha(c.fecha_vencimiento)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-text-primary">
                  {money(c.monto)}
                </span>
                <button
                  type="button"
                  onClick={() => setCobrando(c)}
                  className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90"
                >
                  Cobrar
                </button>
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
