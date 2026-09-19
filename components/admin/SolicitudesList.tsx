"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LuCircleCheck,
  LuPhone,
  LuX,
  LuTriangleAlert,
  LuCopy,
  LuInbox,
} from "react-icons/lu";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  contactadoAction,
  descartarAction,
  activarSolicitudAction,
} from "@/app/admin/(panel)/solicitudes/actions";
import type { Solicitud, SolicitudEstado } from "@/lib/queries/solicitudes.queries";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TZ_MX } from "@/lib/utils/dates";

const ESTADO_VARIANT: Record<SolicitudEstado, BadgeVariant> = {
  nuevo: "success",
  contactado: "warning",
  activado: "success",
  descartado: "neutral",
};

const FILTROS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "nuevo", label: "Nuevas" },
  { key: "contactado", label: "Contactadas" },
  { key: "activado", label: "Activadas" },
  { key: "descartado", label: "Descartadas" },
];

const PLAN_LABEL: Record<string, string> = {
  basico: "Starter",
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
  const [credenciales, setCredenciales] = useState<{
    email: string;
    tempPassword: string;
    slug: string;
  } | null>(null);

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

  function activar(id: string) {
    setMsg(null);
    setCredenciales(null);
    start(async () => {
      const r = await activarSolicitudAction(id);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "Error" });
        return;
      }
      if (r.emailEnviado) {
        setMsg({
          ok: true,
          text: `Gimnasio activado, correo enviado a ${r.email} (/${r.slug})`,
        });
      } else {
        setMsg(null);
        if (r.email && r.tempPassword && r.slug) {
          setCredenciales({
            email: r.email,
            tempPassword: r.tempPassword,
            slug: r.slug,
          });
        }
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros: activo = fondo lleno + texto ácido, sin barra */}
      <div className="flex flex-wrap gap-1">
        {FILTROS.map((f) => {
          const active = estadoActual === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => filtrar(f.key)}
              aria-pressed={active}
              className={`h-11 px-4 text-sm transition-colors ${
                active
                  ? "bg-surface-hover font-medium text-brand-green"
                  : "text-text-secondary hover:bg-surface-hover/60 hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            msg.ok
              ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {credenciales && (
        <div className="space-y-3 border border-warning/40 bg-warning/10 p-5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <p className="flex items-start gap-2 text-warning">
              <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Gimnasio activado (/{credenciales.slug}), pero el correo de
                bienvenida no se pudo enviar. Comparte estas credenciales con
                el dueño:
              </span>
            </p>
            <button
              type="button"
              onClick={() => setCredenciales(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
              aria-label="Cerrar"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 border border-border bg-bg px-4 py-3 font-mono text-dato text-text-primary">
            <span>
              Usuario: <b>{credenciales.email}</b>
            </span>
            <span className="text-text-muted">·</span>
            <span>
              Contraseña temporal: <b>{credenciales.tempPassword}</b>
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Usuario: ${credenciales.email}\nContraseña temporal: ${credenciales.tempPassword}`
                )
              }
              leftIcon={<LuCopy className="h-4 w-4" />}
            >
              Copiar
            </Button>
          </div>
        </div>
      )}

      {solicitudes.length === 0 ? (
        <EmptyState
          icon={<LuInbox />}
          title="Sin solicitudes"
          description={
            estadoActual
              ? "Ninguna solicitud tiene este estado."
              : "Cuando un gimnasio pida su cuenta desde la web, aparece aquí para contactarlo y activarlo."
          }
          action={
            estadoActual ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => filtrar("")}
              >
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="card-surface divide-y divide-border">
          {solicitudes.map((s) => (
            <li key={s.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold leading-5 text-text-primary">
                      {s.nombre_gym || s.nombre}
                    </h3>
                    {s.plan_interes && (
                      <Badge>{PLAN_LABEL[s.plan_interes] ?? s.plan_interes}</Badge>
                    )}
                    <Badge variant={ESTADO_VARIANT[s.estado]}>{s.estado}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {s.nombre} · {s.email}
                    {s.telefono && (
                      <>
                        {" · "}
                        <span className="font-mono tabular-nums">{s.telefono}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
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
                    <p className="mt-1 text-sm text-text-secondary">{s.notas}</p>
                  )}
                </div>

                {s.estado !== "activado" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => activar(s.id)}
                      leftIcon={<LuCircleCheck className="h-4 w-4" />}
                    >
                      Activar
                    </Button>
                    {s.estado !== "contactado" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => contactadoAction(s.id), "Marcada como contactada")
                        }
                        leftIcon={<LuPhone className="h-4 w-4" />}
                      >
                        Contactado
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => descartarAction(s.id), "Descartada")
                      }
                      className="hover:text-danger"
                      leftIcon={<LuX className="h-4 w-4" />}
                    >
                      Descartar
                    </Button>
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
