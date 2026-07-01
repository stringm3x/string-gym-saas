import { PLAN_LABELS, type Plan } from "@/lib/features";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import type { Notificacion } from "@/lib/queries/notifications.queries";

interface HeaderProps {
  gymNombre: string;
  plan: Plan;
  slug: string;
  notificaciones: Notificacion[];
  notificacionesNoLeidas: number;
}

export function Header({
  gymNombre,
  plan,
  slug,
  notificaciones,
  notificacionesNoLeidas,
}: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-8">
      <div>
        <h1 className="text-base font-semibold text-text-primary">
          {gymNombre}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationsBell
          slug={slug}
          notificaciones={notificaciones}
          noLeidas={notificacionesNoLeidas}
        />

        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-brand-green" />
          <span className="text-xs font-medium text-text-secondary">
            Plan {PLAN_LABELS[plan]}
          </span>
        </div>
      </div>
    </header>
  );
}
