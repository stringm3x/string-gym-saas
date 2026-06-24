import { LuCircleCheck } from "react-icons/lu";
import { AlertaCard } from "./AlertaCard";
import type { Alerta } from "@/lib/queries/alertas.queries";

interface AlertasListProps {
  alertas: Alerta[];
}

const SEVERIDAD_ORDER: Alerta["severidad"][] = ["danger", "warning", "info"];

export function AlertasList({ alertas }: AlertasListProps) {
  if (alertas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LuCircleCheck className="h-10 w-10 text-text-muted" />
        <p className="mt-4 text-base font-medium text-text-primary">
          Todo en orden
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          No hay nada que requiera tu atención ahora mismo.
        </p>
      </div>
    );
  }

  const grouped = SEVERIDAD_ORDER.map((sev) => ({
    severidad: sev,
    items: alertas.filter((a) => a.severidad === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {grouped.map(({ severidad, items }) => (
        <section key={severidad}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {severidad === "danger"
              ? "Urgente"
              : severidad === "warning"
                ? "Atención"
                : "Informativo"}
          </h3>
          <div className="space-y-2">
            {items.map((alerta) => (
              <AlertaCard key={alerta.tipo} alerta={alerta} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
