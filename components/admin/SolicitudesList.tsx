"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LuCircleCheck, LuPhone, LuX } from "react-icons/lu";
import {
  contactadoAction,
  descartarAction,
  activarSolicitudAction,
} from "@/app/admin/(panel)/solicitudes/actions";
import type { Solicitud, SolicitudEstado } from "@/lib/queries/solicitudes.queries";
import { TZ_MX } from "@/lib/utils/dates";

const ESTADO_STYLE: Record<SolicitudEstado, string> = {
  nuevo: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  contactado: "border-warning/30 bg-warning/10 text-warning",
  activado: "border-brand-green/40 bg-brand-green/15 text-brand-green",
  descartado: "border-border bg-bg text-text-muted",
};

const FILTROS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "nuevo", label: "Nuevas" },
  { key: "contactado", label: "Contactadas" },
  { key: "activado", label: "Activadas" },
  { key: "descartado", label: "Descartadas" },
];

const PLAN_LABEL: Record<string, string> = {
  basico: "Básico",
  pro: "Pro",
  escala: "Escala",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SolicitudesList({
  solicitudes,
}: {
  solicitudes: Solicitud[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const estadoActual = params.get("estado") ?? "";
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function filtrar(estado: string) {
    const sp = new URLSearchParams();
    if (estado) sp.set("estado", estado);
    router.push(`/admin/solicitudes${sp.toString() ? `?${sp}` : ""}`);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; slug?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "Error" });
        return;
      }
      setMsg({ ok: true, text: r.slug ? `${okText} (/${r.slug})` : okText });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {FILTROS.map((f) => {
          const active = estadoActual === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => filtrar(f.key)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {f.label}
              {active && (
                <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand-green" />
              )}
            </button>
          );
        })}
      </div>

      {msg && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            msg.ok
              ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-secondary">
          No hay solicitudes con este filtro.
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {s.nombre_gym || s.nombre}
                    </h3>
                    {s.plan_interes && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                        {PLAN_LABEL[s.plan_interes] ?? s.plan_interes}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${ESTADO_STYLE[s.estado]}`}
                    >
                      {s.estado}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {s.nombre} · {s.email}
                    {s.telefono && ` · ${s.telefono}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    {[
                      s.ciudad,
                      s.miembros_aprox != null && `~${s.miembros_aprox} miembros`,
                      s.como_entero,
                      fecha(s.created_at),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.notas && (
                    <p className="mt-1 text-xs text-text-secondary">{s.notas}</p>
                  )}
                </div>

                {s.estado !== "activado" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => activarSolicitudAction(s.id),
                          "Gym activado, email enviado"
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
                    >
                      <LuCircleCheck className="h-3.5 w-3.5" /> Activar
                    </button>
                    {s.estado !== "contactado" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => contactadoAction(s.id), "Marcada como contactada")
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                      >
                        <LuPhone className="h-3.5 w-3.5" /> Contactado
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => descartarAction(s.id), "Descartada")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-danger disabled:opacity-50"
                    >
                      <LuX className="h-3.5 w-3.5" /> Descartar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
