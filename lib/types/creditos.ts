export type PlanPagoEstado = "activo" | "completado" | "cancelado";

export interface PlanPago {
  id: string;
  tenant_id: string;
  miembro_id: string;
  plan_membresia_id: string | null;
  total: number;
  cuotas: number;
  concepto: string | null;
  estado: PlanPagoEstado;
  created_at: string;
}

export interface CuotaPago {
  id: string;
  plan_id: string;
  tenant_id: string;
  numero_cuota: number;
  monto: number;
  fecha_vencimiento: string;
  pagado_at: string | null;
  pago_id: string | null;
  created_at: string;
}

/** Estado derivado (no persistido) de una cuota para la UI/CxC. */
export type CuotaEstado = "pagada" | "vencida" | "pendiente";

/** Un plan con sus cuotas y el progreso calculado. */
export interface PlanPagoConCuotas extends PlanPago {
  cuotas_lista: CuotaPago[];
  pagadas: number;
  monto_pagado: number;
  monto_pendiente: number;
}

/** Una cuota pendiente enriquecida para la vista global de CxC. */
export interface CuotaPendiente extends CuotaPago {
  miembro_nombre: string | null;
  plan_concepto: string | null;
  estado_calc: CuotaEstado;
  dias_para_vencer: number;
}

export interface CxCResumen {
  total_pendiente: number;
  vencidas_count: number;
  vencidas_monto: number;
  por_vencer_count: number;
  por_vencer_monto: number;
}
