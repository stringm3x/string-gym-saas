"use client";

import { useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { PlanPagoConCuotas, CuotaPago } from "@/lib/types/creditos";
import { diasEntreHoyY, money } from "@/lib/utils/creditos-calc";
import { CobroCuotaModal } from "./CobroCuotaModal";

const ESTADO_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  activo: { label: "Activo", variant: "success" },
  completado: { label: "Completado", variant: "neutral" },
  cancelado: { label: "Cancelado", variant: "danger" },
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

/** Plan de pagos a plazos: cabecera con chip de estado, barra de avance
 * de esquina viva, y una fila por cuota con fecha y monto en mono. */
export function PlanPagoCard({
  plan,
  miembroNombre,
}: {
  plan: PlanPagoConCuotas;
  miembroNombre: string;
}) {
  const [cobrando, setCobrando] = useState<CuotaPago | null>(null);
  const estado = ESTADO_BADGE[plan.estado] ?? ESTADO_BADGE.cancelado;
  const avance = Math.round((plan.pagadas / plan.cuotas) * 100);

  return (
    <div className="border border-border bg-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-text-primary">
              {plan.concepto || "Plan a plazos"}
            </h4>
            <Badge variant={estado.variant}>{estado.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-text-muted">
            Total <span className="font-mono text-text-secondary">{money(plan.total)}</span>{" "}
            · <span className="font-mono text-text-secondary">{plan.pagadas}/{plan.cuotas}</span>{" "}
            cuotas pagadas · pendiente{" "}
            <span className="font-mono text-text-secondary">
              {money(plan.monto_pendiente)}
            </span>
          </p>
        </div>
      </div>

      {/* Barra de avance */}
      <div
        className="mx-5 h-1.5 w-auto overflow-hidden bg-surface-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={avance}
        aria-label="Avance del plan"
      >
        <div
          className="h-full bg-brand-green transition-[width]"
          style={{ width: `${avance}%` }}
        />
      </div>

      {/* Cuotas */}
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {plan.cuotas_lista.map((c) => {
          const estadoCuota = cuotaEstado(c);
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 px-5 py-2"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  className={cn(
                    "w-[76px] shrink-0 font-mono text-dato tabular-nums",
                    estadoCuota === "vencida"
                      ? "text-danger"
                      : estadoCuota === "pagada"
                        ? "text-text-muted"
                        : "text-text-secondary"
                  )}
                >
                  {c.pagado_at
                    ? fecha(c.pagado_at.slice(0, 10))
                    : fecha(c.fecha_vencimiento)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] leading-5 text-text-primary">
                    Cuota {c.numero_cuota}
                    {estadoCuota === "vencida" && (
                      <Badge variant="danger">Vencida</Badge>
                    )}
                    {estadoCuota === "pagada" && (
                      <Badge variant="success">Pagada</Badge>
                    )}
                  </p>
                  <p className="text-sm text-text-muted">
                    {c.pagado_at ? "Pagada el" : "Vence el"}{" "}
                    <span className="font-mono">
                      {c.pagado_at
                        ? fecha(c.pagado_at.slice(0, 10))
                        : fecha(c.fecha_vencimiento)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <span
                  className={cn(
                    "font-mono text-dato tabular-nums",
                    estadoCuota === "pagada" ? "text-text-muted" : "text-text-primary"
                  )}
                >
                  {money(Number(c.monto))}
                </span>
                {!c.pagado_at && plan.estado === "activo" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCobrando(c)}
                  >
                    Registrar pago
                  </Button>
                )}
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
          totalCuotas={plan.cuotas}
          monto={Number(cobrando.monto)}
          miembroNombre={miembroNombre}
        />
      )}
    </div>
  );
}
