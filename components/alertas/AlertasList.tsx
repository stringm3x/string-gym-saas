import { AlertaCard } from "./AlertaCard";
import type { Alerta } from "@/lib/queries/alertas.queries";

interface AlertasListProps {
  alertas: Alerta[];
  /** Filas adicionales ya renderizadas (mismo estilo), p. ej. avisos de datos. */
  extra?: React.ReactNode;
}

const SEVERIDAD_ORDER: Alerta["severidad"][] = ["danger", "warning", "info"];

/** Lista de puntos de atención, de lo urgente a lo informativo. Va dentro
 * de una tarjeta (panel del día); el vacío de área completa lo pone la
 * página de alertas. */
export function AlertasList({ alertas, extra }: AlertasListProps) {
  if (alertas.length === 0 && !extra) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Todo en orden: nada requiere tu atención ahora mismo.
      </p>
    );
  }

  const ordenadas = SEVERIDAD_ORDER.flatMap((sev) =>
    alertas.filter((a) => a.severidad === sev)
  );

  return (
    <ul className="divide-y divide-border">
      {ordenadas.map((alerta) => (
        <AlertaCard key={alerta.tipo} alerta={alerta} />
      ))}
      {extra}
    </ul>
  );
}
