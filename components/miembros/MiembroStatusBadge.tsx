import { Badge } from "@/components/ui/Badge";
import {
  getEstadoMembresia,
  diasParaVencer,
  type EstadoMembresia,
} from "@/lib/utils/estado-membresia";

interface MiembroStatusBadgeProps {
  fechaVencimiento: string | null | undefined;
  /** Plan por visitas (D3): si se pasa, la vigencia la manda el saldo. */
  visitasRestantes?: number | null;
}

const labels: Record<EstadoMembresia, string> = {
  activo: "Activo",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_membresia: "Sin membresía",
};

const variants: Record<
  EstadoMembresia,
  "success" | "warning" | "danger" | "neutral"
> = {
  activo: "success",
  por_vencer: "warning",
  vencido: "danger",
  sin_membresia: "neutral",
};

export function MiembroStatusBadge({
  fechaVencimiento,
  visitasRestantes,
}: MiembroStatusBadgeProps) {
  const porVisitas =
    visitasRestantes !== null && visitasRestantes !== undefined;
  const estado = getEstadoMembresia(fechaVencimiento, undefined, visitasRestantes);
  const dias = diasParaVencer(fechaVencimiento);

  let label = labels[estado];

  if (porVisitas) {
    label =
      visitasRestantes <= 0
        ? "Sin visitas"
        : `${visitasRestantes} ${visitasRestantes === 1 ? "visita" : "visitas"}`;
  } else if (estado === "por_vencer" && dias !== null) {
    label = dias === 0 ? "Vence hoy" : `Vence en ${dias}d`;
  } else if (estado === "vencido" && dias !== null) {
    label = `Venció hace ${Math.abs(dias)}d`;
  }

  return <Badge variant={variants[estado]}>{label}</Badge>;
}
