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

export function formatFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha + "T00:00:00") : fecha;
  return formatterFecha.format(d);
}

export function formatFechaCorta(
  fecha: string | Date | null | undefined
): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha + "T00:00:00") : fecha;
  return formatterFechaCorta.format(d);
}

export function formatFechaHora(
  fecha: string | Date | null | undefined
): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return formatterFechaHora.format(d);
}
