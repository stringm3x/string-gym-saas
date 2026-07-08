"use client";

import { usePathname } from "next/navigation";
import { LuChevronRight } from "react-icons/lu";

// Etiquetas por segmento de ruta. Un segmento no listado (p. ej. un id) se
// muestra como "Detalle".
const LABELS: Record<string, string> = {
  miembros: "Miembros",
  caja: "Caja",
  checkins: "Check-in",
  clases: "Clases",
  inventario: "Inventario",
  productos: "Productos",
  movimientos: "Movimientos",
  prospectos: "Prospectos",
  alertas: "Alertas",
  configuracion: "Configuración",
  "cuentas-por-cobrar": "Cuentas por cobrar",
  comunicaciones: "Comunicaciones",
  campanas: "Campañas",
  recibos: "Recibos",
  notas: "Notas",
  nuevo: "Nuevo",
  importar: "Importar",
};

function label(seg: string): string {
  return LABELS[seg] ?? "Detalle";
}

export function Breadcrumb({ gymNombre }: { gymNombre: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] = slug; el resto es la ruta dentro del tenant.
  const rest = segments.slice(1);

  // Solo en subpáginas/detalle (>= 2 niveles). Oculto en dashboard/hoy y en
  // las listas de nivel superior.
  if (rest.length < 2) return null;
  if (rest[0] === "hoy" || rest[0] === "dashboard") return null;

  const crumbs = [gymNombre, ...rest.map(label)];

  return (
    <nav
      aria-label="Ruta"
      className="mt-0.5 hidden items-center gap-1 text-xs text-text-muted sm:flex"
    >
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <LuChevronRight className="h-3 w-3" />}
          <span
            className={
              i === crumbs.length - 1 ? "text-text-secondary" : undefined
            }
          >
            {c}
          </span>
        </span>
      ))}
    </nav>
  );
}
