const formatterMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const formatterFecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatterFechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
});

const formatterFechaHora = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoneda(valor: number): string {
  return formatterMoneda.format(valor);
}

function toDate(fecha: string | Date): Date {
  if (typeof fecha !== "string") return fecha;
  // Si ya es ISO completo (contiene "T"), parsear directo.
  // Si es solo fecha "YYYY-MM-DD", añadir medianoche local para evitar desfase UTC.
  return fecha.includes("T") ? new Date(fecha) : new Date(fecha + "T00:00:00");
}

export function formatFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  return formatterFecha.format(toDate(fecha));
}

export function formatFechaCorta(
  fecha: string | Date | null | undefined
): string {
  if (!fecha) return "—";
  return formatterFechaCorta.format(toDate(fecha));
}

export function formatFechaHora(
  fecha: string | Date | null | undefined
): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return formatterFechaHora.format(d);
}
