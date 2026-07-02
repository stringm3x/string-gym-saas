"use client";

import { useState } from "react";
import { LuCircleCheck, LuClock, LuTriangleAlert } from "react-icons/lu";
import type { PlanPagoConCuotas, CuotaPago } from "@/lib/types/creditos";
import { diasEntreHoyY, money } from "@/lib/utils/creditos-calc";
import { CobroCuotaModal } from "./CobroCuotaModal";

const ESTADO_BADGE: Record<string, string> = {
  activo: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  completado: "border-border bg-bg text-text-muted",
  cancelado: "border-danger/30 bg-danger/10 text-danger",
};

function fecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cuotaEstado(c: CuotaPago): "pagada" | "vencida" | "pendiente" {
  if (c.pagado_at) return "pagada";
  return diasEntreHoyY(c.fecha_vencimiento) < 0 ? "vencida" : "pendiente";
}

export function PlanPagoCard({
  plan,
  miembroNombre,
}: {
  plan: PlanPagoConCuotas;
  miembroNombre: string;
}) {
  const [cobrando, setCobrando] = useState<CuotaPago | null>(null);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text-primary">
              {plan.concepto || "Plan a plazos"}
            </h4>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                ESTADO_BADGE[plan.estado] ?? ESTADO_BADGE.cancelado
              }`}
            >
              {plan.estado}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            Total {money(plan.total)} · {plan.pagadas}/{plan.cuotas} cuotas
            pagadas · pendiente {money(plan.monto_pendiente)}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-brand-green transition-all"
          style={{ width: `${(plan.pagadas / plan.cuotas) * 100}%` }}
        />
      </div>

      {/* Cuotas */}
      <ul className="mt-4 space-y-2">
        {plan.cuotas_lista.map((c) => {
          const estado = cuotaEstado(c);
          const Icono =
            estado === "pagada"
              ? LuCircleCheck
              : estado === "vencida"
                ? LuTriangleAlert
                : LuClock;
          const color =
            estado === "pagada"
              ? "text-brand-green"
              : estado === "vencida"
                ? "text-danger"
                : "text-text-muted";
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <Icono className={`h-4 w-4 shrink-0 ${color}`} />
                <div>
                  <p className="text-xs font-medium text-text-primary">
                    Cuota {c.numero_cuota} · {money(Number(c.monto))}
                    {estado === "vencida" && (
                      <span className="ml-2 rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-danger">
                        Vencida
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    {c.pagado_at
                      ? `Pagada el ${fecha(c.pagado_at.slice(0, 10))}`
                      : `Vence ${fecha(c.fecha_vencimiento)}`}
                  </p>
                </div>
              </div>

              {!c.pagado_at && plan.estado === "activo" && (
                <button
                  type="button"
                  onClick={() => setCobrando(c)}
                  className="shrink-0 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90"
                >
                  Registrar pago
                </button>
              )}
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
          totalCuotas={plan.cuotas}
          monto={Number(cobrando.monto)}
          miembroNombre={miembroNombre}
        />
      )}
    </div>
  );
}
