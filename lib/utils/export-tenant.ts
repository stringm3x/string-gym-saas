import JSZip from "jszip";
import { TZ_MX } from "@/lib/utils/dates";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Exporta todos los datos operativos de un tenant (miembros, pagos, check-ins)
 * como un ZIP en memoria con 3 CSVs. Se usa al cancelar un tenant desde el
 * Admin, para entregarle sus datos al owner antes de darlo de baja.
 *
 * Usa service-role: corre en contexto de Admin (sin sesión del tenant).
 */
export async function exportTenantData(tenantId: string): Promise<Buffer> {
  const admin = createAdminClient();

  const [miembrosRes, pagosRes, checkinsRes, planesRes] = await Promise.all([
    admin
      .from("miembros")
      .select(
        "id, nombre, email, telefono, fecha_inscripcion, fecha_vencimiento, estado, plan_id"
      )
      .eq("tenant_id", tenantId)
      .order("fecha_inscripcion", { ascending: true }),
    admin
      .from("pagos")
      .select(
        "fecha_pago, miembro_id, nombre_visitante, concepto, monto, metodo_pago, folio, anulado_at"
      )
      .eq("tenant_id", tenantId)
      .order("fecha_pago", { ascending: true }),
    admin
      .from("checkins")
      .select("fecha_hora, miembro_id")
      .eq("tenant_id", tenantId)
      .order("fecha_hora", { ascending: true }),
    admin
      .from("planes_membresia")
      .select("id, nombre")
      .eq("tenant_id", tenantId),
  ]);

  const miembros = miembrosRes.data ?? [];
  const pagos = pagosRes.data ?? [];
  const checkins = checkinsRes.data ?? [];

  const nombrePlan = new Map<string, string>(
    (planesRes.data ?? []).map((p) => [p.id, p.nombre])
  );
  const nombreMiembro = new Map<string, string>(
    miembros.map((m) => [m.id, m.nombre])
  );

  // miembros.csv
  const miembrosCsv = toCSV(
    ["nombre", "email", "telefono", "fecha_registro", "fecha_vencimiento", "estado", "plan"],
    miembros.map((m) => [
      m.nombre,
      m.email,
      m.telefono,
      m.fecha_inscripcion,
      m.fecha_vencimiento,
      m.estado,
      m.plan_id ? nombrePlan.get(m.plan_id) ?? "" : "",
    ])
  );

  // pagos.csv
  const pagosCsv = toCSV(
    ["fecha", "miembro", "concepto", "monto", "metodo", "folio", "anulado"],
    pagos.map((p) => [
      p.fecha_pago,
      p.miembro_id
        ? nombreMiembro.get(p.miembro_id) ?? ""
        : p.nombre_visitante ?? "",
      p.concepto,
      p.monto,
      p.metodo_pago,
      p.folio ?? "",
      p.anulado_at ? "sí" : "",
    ])
  );

  // checkins.csv — la tabla solo guarda fecha_hora + miembro (no hay "tipo").
  const checkinsCsv = toCSV(
    ["fecha", "hora", "miembro"],
    checkins.map((c) => {
      const d = new Date(c.fecha_hora);
      return [
        c.fecha_hora ? d.toLocaleDateString("es-MX", { timeZone: TZ_MX }) : "",
        c.fecha_hora
          ? d.toLocaleTimeString("es-MX", {
              timeZone: TZ_MX,
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        c.miembro_id ? nombreMiembro.get(c.miembro_id) ?? "" : "",
      ];
    })
  );

  const zip = new JSZip();
  zip.file("miembros.csv", miembrosCsv);
  zip.file("pagos.csv", pagosCsv);
  zip.file("checkins.csv", checkinsCsv);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Construye un CSV con escape RFC-4180 y BOM UTF-8 (para Excel). */
function toCSV(
  headers: string[],
  rows: (string | number | null)[][]
): string {
  const esc = (v: string | number | null): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}
