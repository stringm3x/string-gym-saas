import { Badge } from "@/components/ui/Badge";
import {
  getEstadoMembresia,
  diasParaVencer,
  type EstadoMembresia,
} from "@/lib/utils/estado-membresia";

interface MiembroStatusBadgeProps {
  fechaVencimiento: string | null | undefined;
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
}: MiembroStatusBadgeProps) {
  const estado = getEstadoMembresia(fechaVencimiento);
  const dias = diasParaVencer(fechaVencimiento);

  let label = labels[estado];

  if (estado === "por_vencer" && dias !== null) {
    label = dias === 0 ? "Vence hoy" : `Vence en ${dias}d`;
  } else if (estado === "vencido" && dias !== null) {
    label = `Venció hace ${Math.abs(dias)}d`;
  }

  return <Badge variant={variants[estado]}>{label}</Badge>;
}
