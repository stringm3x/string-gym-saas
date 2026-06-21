/** Una fila del CSV de importación (columnas soportadas por el esquema). */
export interface CSVRow {
  nombre: string;
  telefono?: string;
  email?: string;
  fecha_inscripcion?: string;
  fecha_vencimiento?: string;
  plan?: string;
  notas?: string;
}

export interface ValidationError {
  /** Fila en el CSV (1-indexed, excluyendo el header). */
  row: number;
  field: string;
  value: string;
  reason: string;
}

/** Resultado de mapear el `plan` del CSV contra los planes del gym. */
export type PlanMatch =
  | { status: "ok"; planId: string; planNombre: string }
  | { status: "sin_plan" }
  | { status: "no_encontrado"; planNombre: string };

/** Fila válida lista para previsualizar/importar. */
export interface PreviewRow {
  row: number;
  data: CSVRow;
  plan: PlanMatch;
  duplicateInCSV: boolean;
  duplicateInDB: boolean;
}

export interface ImportPreview {
  totalRows: number;
  validRows: PreviewRow[];
  invalidRows: ValidationError[];
  duplicatesInCSV: number;
  duplicatesInDB: number;
  plansNotFound: string[];
}

export interface ImportResult {
  ok: boolean;
  totalProcessed: number;
  successCount: number;
  sinPlanCount: number;
  failedCount: number;
  errors: ValidationError[];
  /** ej: 'csv:2026-06-22-a1b2c3' */
  originId: string;
}
