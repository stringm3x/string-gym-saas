import { PLAN_LABELS, type Plan } from "@/lib/features";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
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
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 sm:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-text-primary">
          {gymNombre}
        </h1>
        <Breadcrumb gymNombre={gymNombre} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <GlobalSearch slug={slug} />

        <NotificationsBell
          slug={slug}
          notificaciones={notificaciones}
          noLeidas={notificacionesNoLeidas}
        />

        {/* Badge de plan: oculto en mobile para dejar aire */}
        <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 sm:flex">
          <span className="h-2 w-2 rounded-full bg-brand-green" />
          <span className="text-xs font-medium text-text-secondary">
            Plan {PLAN_LABELS[plan]}
          </span>
        </div>

        <HeaderUserMenu slug={slug} />
      </div>
    </header>
  );
}
