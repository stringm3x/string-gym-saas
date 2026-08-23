import { LuTriangleAlert } from "react-icons/lu";

/** Mismo umbral (14+ días sin check-in) que dispara MIEMBRO_SIN_ACTIVIDAD al dueño. */
export function RiesgoInactividadBadge({ dias }: { dias: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
      title={`Sin check-in hace ${dias} días`}
    >
      <LuTriangleAlert className="h-3.5 w-3.5" />
      Sin check-in hace {dias} días
    </span>
  );
}
