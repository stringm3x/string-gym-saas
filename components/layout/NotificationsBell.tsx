"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LuBell,
  LuClock,
  LuDollarSign,
  LuUserPlus,
  LuInfo,
  LuCalendar,
  LuCheck,
} from "react-icons/lu";
import {
  marcarNotificacionLeidaAction,
  marcarTodasLeidasAction,
} from "@/app/(tenant)/[slug]/notificaciones-actions";
import type { Notificacion } from "@/lib/queries/notifications.queries";
import type { NotificacionTipo } from "@/lib/utils/notifications";
import { TZ_MX } from "@/lib/utils/dates";

const ICONO: Record<NotificacionTipo, typeof LuBell> = {
  vencimiento: LuClock,
  pago: LuDollarSign,
  prospecto: LuUserPlus,
  sistema: LuInfo,
  clase: LuCalendar,
};

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
  });
}

export function NotificationsBell({
  slug,
  notificaciones,
  noLeidas,
}: {
  slug: string;
  notificaciones: Notificacion[];
  noLeidas: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function abrir(n: Notificacion) {
    setOpen(false);
    start(async () => {
      if (!n.leida) await marcarNotificacionLeidaAction(n.id);
      if (n.accion_url) router.push(`/${slug}/${n.accion_url}`);
      else router.refresh();
    });
  }

  function marcarTodas() {
    start(async () => {
      await marcarTodasLeidasAction();
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
      >
        <LuBell className="h-5 w-5" />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-brand-green px-1 text-xs font-bold text-on-brand">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Cierre al hacer click fuera */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold text-text-primary">
                Notificaciones
              </span>
              {noLeidas > 0 && (
                <button
                  type="button"
                  onClick={marcarTodas}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1 text-xs text-brand-green underline-offset-4 hover:underline disabled:opacity-50"
                >
                  <LuCheck className="h-3.5 w-3.5" /> Marcar todas
                </button>
              )}
            </div>

            {notificaciones.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Sin notificaciones.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notificaciones.map((n) => {
                  const Icono = ICONO[n.tipo] ?? LuInfo;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => abrir(n)}
                        className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                          n.leida ? "opacity-60" : ""
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-brand-green">
                          <Icono className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {!n.leida && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
                            )}
                            <span className="truncate text-sm font-medium text-text-primary">
                              {n.titulo}
                            </span>
                          </span>
                          {n.mensaje && (
                            <span className="mt-0.5 block truncate text-xs text-text-secondary">
                              {n.mensaje}
                            </span>
                          )}
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {tiempoRelativo(n.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
