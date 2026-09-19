import { Badge } from "@/components/ui/Badge";

/** Regla fija: 14+ días sin check-in (el mismo umbral que avisa al dueño). */
export function RiesgoInactividadBadge({ dias }: { dias: number }) {
  return (
    <Badge variant="warning" className="whitespace-nowrap">
      Sin check-in {dias} d
    </Badge>
  );
}
