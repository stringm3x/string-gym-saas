"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { listPlanes } from "@/lib/queries/planes.queries";
import {
  bulkCreateMiembros,
  getExistingContactos,
  type BulkMiembroRow,
} from "@/lib/queries/miembros.queries";
import { csvRowSchema } from "@/lib/validations/import.schema";
import { parseCSV } from "@/lib/utils/csv-parser";
import type {
  CSVRow,
  ImportPreview,
  ImportResult,
  PlanMatch,
  PreviewRow,
  ValidationError,
} from "@/lib/types/import";

const MAX_BYTES = 5 * 1024 * 1024;

function normTel(t?: string): string {
  return (t ?? "").replace(/\D/g, "");
}
function normEmail(e?: string): string {
  return (e ?? "").trim().toLowerCase();
}

/** Mapa nombre-de-plan (normalizado) → { id, nombre }. */
async function getPlanesMap(tenantId: string) {
  const planes = await listPlanes(tenantId);
  const map = new Map<string, { id: string; nombre: string }>();
  for (const p of planes) {
    map.set(p.nombre.trim().toLowerCase(), { id: p.id, nombre: p.nombre });
  }
  return map;
}

function resolverPlan(
  planNombre: string | undefined,
  map: Map<string, { id: string; nombre: string }>
): PlanMatch {
  const raw = (planNombre ?? "").trim();
  if (!raw) return { status: "sin_plan" };
  const hit = map.get(raw.toLowerCase());
  if (hit) return { status: "ok", planId: hit.id, planNombre: hit.nombre };
  return { status: "no_encontrado", planNombre: raw };
}

export async function parsearCSVAction(
  formData: FormData
): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  const tenant = await getTenant();
  if (tenant.role !== "owner") {
    return { ok: false, error: "Solo el dueño puede importar miembros." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "El archivo supera el máximo de 5MB." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "El archivo debe ser .csv" };
  }

  const text = await file.text();
  const { rows } = parseCSV(text);

  const [planesMap, existentes] = await Promise.all([
    getPlanesMap(tenant.id),
    getExistingContactos(tenant.id),
  ]);

  const validRows: PreviewRow[] = [];
  const invalidRows: ValidationError[] = [];
  const plansNotFound = new Set<string>();

  const seenTel = new Set<string>();
  const seenEmail = new Set<string>();
  let duplicatesInCSV = 0;
  let duplicatesInDB = 0;

  rows.forEach((raw, i) => {
    const rowNum = i + 1; // 1-indexed, excluye header
    const parsed = csvRowSchema.safeParse(raw);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] !== undefined ? String(issue.path[0]) : "fila";
        invalidRows.push({
          row: rowNum,
          field,
          value: String((raw as Record<string, string>)[field] ?? ""),
          reason: issue.message,
        });
      }
      return;
    }

    const data = parsed.data as CSVRow;
    const plan = resolverPlan(data.plan, planesMap);
    if (plan.status === "no_encontrado") plansNotFound.add(plan.planNombre);

    const tel = normTel(data.telefono);
    const email = normEmail(data.email);

    const dupCSV = (tel && seenTel.has(tel)) || (email && seenEmail.has(email));
    const dupDB =
      (tel && existentes.telefonos.has(tel)) ||
      (email && existentes.emails.has(email));

    if (dupCSV) duplicatesInCSV += 1;
    if (dupDB) duplicatesInDB += 1;
    if (tel) seenTel.add(tel);
    if (email) seenEmail.add(email);

    validRows.push({
      row: rowNum,
      data,
      plan,
      duplicateInCSV: Boolean(dupCSV),
      duplicateInDB: Boolean(dupDB),
    });
  });

  return {
    ok: true,
    preview: {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicatesInCSV,
      duplicatesInDB,
      plansNotFound: Array.from(plansNotFound),
    },
  };
}

export async function importarMiembrosAction(
  rows: CSVRow[]
): Promise<ImportResult> {
  const tenant = await getTenant();

  const base: ImportResult = {
    ok: false,
    totalProcessed: 0,
    successCount: 0,
    sinPlanCount: 0,
    failedCount: 0,
    errors: [],
    originId: "",
  };

  if (tenant.role !== "owner") {
    return { ...base, errors: [{ row: 0, field: "", value: "", reason: "Sin permiso." }] };
  }
  if (!rows.length) return base;

  const planesMap = await getPlanesMap(tenant.id);
  const hoy = new Date().toISOString().slice(0, 10);

  // Re-validar en servidor (defensa) y resolver planes.
  const bulkRows: BulkMiembroRow[] = [];
  const errors: ValidationError[] = [];
  let sinPlanCount = 0;

  rows.forEach((raw, i) => {
    const parsed = csvRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        row: i + 1,
        field: String(parsed.error.issues[0]?.path[0] ?? "fila"),
        value: "",
        reason: parsed.error.issues[0]?.message ?? "Fila inválida",
      });
      return;
    }
    const data = parsed.data as CSVRow;
    const plan = resolverPlan(data.plan, planesMap);
    const planId = plan.status === "ok" ? plan.planId : null;
    if (planId === null) sinPlanCount += 1;

    bulkRows.push({
      nombre: data.nombre,
      telefono: data.telefono ? data.telefono : null,
      email: data.email ? data.email : null,
      fecha_inscripcion: data.fecha_inscripcion || hoy,
      fecha_vencimiento: data.fecha_vencimiento || null,
      notas: data.notas ? data.notas : null,
      plan_id: planId,
    });
  });

  const originId = `csv:${hoy}-${crypto.randomUUID().slice(0, 8)}`;
  const result = await bulkCreateMiembros(tenant.id, bulkRows, originId);

  // Mapear fallos de inserción a errores legibles.
  for (const f of result.failures) {
    errors.push({
      row: f.index + 1,
      field: "",
      value: bulkRows[f.index]?.nombre ?? "",
      reason: f.error,
    });
  }

  revalidatePath(`/${tenant.slug}/miembros`);

  return {
    ok: true,
    totalProcessed: rows.length,
    successCount: result.successCount,
    sinPlanCount,
    failedCount: errors.length,
    errors,
    originId,
  };
}
