import { LuScanLine } from "react-icons/lu";
import { formatFechaHora } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Checkin } from "@/lib/queries/checkins.queries";

interface CheckinsHistoryProps {
  checkins: Checkin[];
}

export function CheckinsHistory({ checkins }: CheckinsHistoryProps) {
  if (checkins.length === 0) {
    return (
      <EmptyState
        icon={<LuScanLine className="h-5 w-5" />}
        title="Sin check-ins registrados"
        description="Cuando este miembro acuda al gimnasio, sus visitas aparecerán aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {checkins.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
          <LuScanLine
            className="h-3.5 w-3.5 shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-text-secondary">
            {formatFechaHora(c.fecha_hora)}
          </span>
        </li>
      ))}
    </ul>
  );
}
