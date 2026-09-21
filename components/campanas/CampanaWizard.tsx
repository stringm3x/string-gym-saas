"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LuUsers,
  LuArrowLeft,
  LuArrowRight,
  LuExternalLink,
  LuCheck,
  LuCircleCheck,
} from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { compilarPlantilla } from "@/lib/utils/plantilla";
import {
  enviarCampanaAction,
  marcarCampanaEnviadaManualAction,
} from "@/app/(tenant)/[slug]/comunicaciones/campanas/actions";
import type { Audiencia } from "@/lib/validations/campanas.schema";
import type { Destinatario } from "@/lib/queries/campanas.queries";

export interface AudienciaData {
  value: Audiencia;
  label: string;
  descripcion: string;
  total: number;
  sinTelefono: number;
  destinatarios: Destinatario[];
}

function renderMensaje(msg: string, d: Destinatario): string {
  const venc = d.fecha_vencimiento
    ? new Date(d.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  return compilarPlantilla(msg, { nombre: d.nombre, fecha_vencimiento: venc });
}

export function CampanaWizard({
  audiencias,
  onDone,
}: {
  audiencias: AudienciaData[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [audiencia, setAudiencia] = useState<Audiencia | null>(null);
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviada, setEnviada] = useState(false);
  // true si se envió por la API de WhatsApp (vs modo wa.me manual).
  const [apiSent, setApiSent] = useState(false);
  const [enviadosApi, setEnviadosApi] = useState(0);
  const [fallidosApi, setFallidosApi] = useState(0);
  const [campanaId, setCampanaId] = useState<string | null>(null);
  const [confirmando, startConfirmar] = useTransition();

  const audData = useMemo(
    () => audiencias.find((a) => a.value === audiencia) ?? null,
    [audiencias, audiencia]
  );
  const destinatarios = audData?.destinatarios ?? [];

  function enviar() {
    if (!audiencia) return;
    start(async () => {
      const r = await enviarCampanaAction({ nombre, mensaje, audiencia });
      if (!r.ok) {
        toastError("No se pudo registrar la campaña", r.error);
        return;
      }
      setEnviada(true);
      setCampanaId(r.campanaId ?? null);
      if (r.enviadoPorApi) {
        // Enviada por la API: no abrimos wa.me.
        setApiSent(true);
        const enviados = r.enviados ?? 0;
        const fallidos = r.fallidos ?? 0;
        setEnviadosApi(enviados);
        setFallidosApi(fallidos);
        if (fallidos === 0) {
          success(`Campaña enviada por WhatsApp · ${enviados} mensajes`);
        } else if (enviados === 0) {
          toastError(
            "No se pudo enviar la campaña",
            `Los ${fallidos} envíos fallaron. Revisa la configuración de WhatsApp.`
          );
        } else {
          toastError(
            "Envío parcial",
            `${enviados} enviados, ${fallidos} fallidos.`
          );
        }
      } else {
        if (destinatarios[0]) {
          window.open(
            buildWhatsAppUrl(
              destinatarios[0].telefono,
              renderMensaje(mensaje, destinatarios[0])
            ),
            "_blank"
          );
        }
        success(`Campaña registrada · ${r.total} destinatarios`);
      }
      router.refresh();
    });
  }

  const inputClass =
    "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

  return (
    <div className="border border-border bg-surface p-5">
      {/* Pasos: número en círculo (badge numérico) + etiqueta en mono. */}
      <ol className="mb-5 flex items-center gap-2">
        {["Audiencia", "Mensaje", "Enviar"].map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const activo = paso === n;
          const hecho = paso > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  activo
                    ? "bg-brand-green text-on-brand"
                    : hecho
                      ? "border border-brand-green text-brand-green"
                      : "border border-border text-text-muted"
                }`}
              >
                {hecho ? <LuCheck className="h-3 w-3" /> : n}
              </span>
              <span
                aria-current={activo ? "step" : undefined}
                className={`font-mono text-etiqueta uppercase ${
                  activo ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {label}
              </span>
              {n < 3 && (
                <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Paso 1 — Audiencia */}
      {paso === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {audiencias.map((a) => {
              const sel = audiencia === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudiencia(a.value)}
                  aria-pressed={sel}
                  className={`flex min-h-[44px] items-start justify-between gap-3 border px-4 py-3 text-left transition-colors ${
                    sel
                      ? "border-brand-green bg-surface-hover"
                      : "border-border hover:border-text-secondary"
                  }`}
                >
                  <span>
                    <span
                      className={`block text-sm font-semibold ${
                        sel ? "text-brand-green" : "text-text-primary"
                      }`}
                    >
                      {a.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      {a.descripcion}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-dato font-bold tabular-nums text-text-primary">
                    <LuUsers
                      className="h-3.5 w-3.5 text-text-muted"
                      aria-hidden="true"
                    />
                    {a.total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={onDone}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!audiencia || (audData?.total ?? 0) === 0}
              onClick={() => setPaso(2)}
              rightIcon={<LuArrowRight className="h-4 w-4" />}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Paso 2 — Mensaje */}
      {paso === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campana-nombre">Nombre de la campaña</Label>
            <input
              id="campana-nombre"
              type="text"
              value={nombre}
              maxLength={100}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Recordatorio de renovación"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="campana-mensaje">Mensaje</Label>
              <span className="font-mono text-xs tabular-nums text-text-muted">
                {mensaje.length}/1000
              </span>
            </div>
            <textarea
              id="campana-mensaje"
              value={mensaje}
              maxLength={1000}
              rows={5}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Hola {{nombre}}, tu membresía vence el {{fecha_vencimiento}}. ¡Renuévala y sigue entrenando!"
              className="w-full resize-y rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-etiqueta uppercase text-text-muted">
                Variables
              </span>
              {["{{nombre}}", "{{fecha_vencimiento}}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMensaje((m) => m + v)}
                  className="inline-flex h-9 items-center border border-border px-3 font-mono text-xs text-brand-green transition-colors hover:border-brand-green"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {destinatarios[0] && mensaje && (
            <div className="border border-border bg-bg px-4 py-3">
              <p className="font-mono text-etiqueta uppercase text-text-muted">
                Vista previa · {destinatarios[0].nombre}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">
                {renderMensaje(mensaje, destinatarios[0])}
              </p>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPaso(1)}
              leftIcon={<LuArrowLeft className="h-4 w-4" />}
            >
              Atrás
            </Button>
            <Button
              type="button"
              disabled={!nombre.trim() || !mensaje.trim()}
              onClick={() => setPaso(3)}
              rightIcon={<LuArrowRight className="h-4 w-4" />}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Enviar */}
      {paso === 3 && audData && (
        <div className="space-y-4">
          <div className="divide-y divide-border border border-border bg-bg text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-text-secondary">Audiencia</span>
              <span className="font-medium text-text-primary">
                {audData.label}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-text-secondary">Destinatarios</span>
              <span className="font-mono text-dato font-bold tabular-nums text-text-primary">
                {audData.total}
              </span>
            </div>
            {audData.sinTelefono > 0 && (
              <p className="px-4 py-3 text-xs text-warning">
                {audData.sinTelefono} sin teléfono: se excluyen del envío.
              </p>
            )}
          </div>

          {!enviada ? (
            <>
              <div>
                <p className="mb-2 font-mono text-etiqueta uppercase text-text-muted">
                  Primeros destinatarios
                </p>
                <ul className="divide-y divide-border border border-border text-sm">
                  {destinatarios.slice(0, 5).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="truncate text-text-primary">
                        {d.nombre}
                      </span>
                      <span className="shrink-0 font-mono text-dato tabular-nums text-text-muted">
                        {d.telefono}
                      </span>
                    </li>
                  ))}
                </ul>
                {destinatarios.length > 5 && (
                  <p className="mt-2 text-xs text-text-muted">
                    y {destinatarios.length - 5} más
                  </p>
                )}
              </div>

              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaso(2)}
                  leftIcon={<LuArrowLeft className="h-4 w-4" />}
                >
                  Atrás
                </Button>
                <Button
                  type="button"
                  disabled={destinatarios.length === 0}
                  loading={pending}
                  onClick={enviar}
                  leftIcon={<FaWhatsapp className="h-4 w-4" />}
                >
                  {pending ? "Enviando…" : "Enviar campaña"}
                </Button>
              </div>
            </>
          ) : apiSent ? (
            <>
              <div
                className={`flex items-center gap-2 border px-4 py-3 text-sm text-text-primary ${
                  fallidosApi === 0 ? "border-brand-green" : "border-danger"
                }`}
              >
                <LuCircleCheck
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 ${
                    fallidosApi === 0 ? "text-brand-green" : "text-danger"
                  }`}
                />
                <span>
                  {fallidosApi === 0
                    ? `Campaña enviada por WhatsApp a ${enviadosApi} ${enviadosApi === 1 ? "contacto" : "contactos"}.`
                    : `${enviadosApi} enviados, ${fallidosApi} fallidos de ${enviadosApi + fallidosApi} contactos.`}
                </span>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={onDone}>
                  Terminar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="border border-brand-green px-4 py-3 text-sm text-text-primary">
                Campaña registrada. Se abrió el primer chat; abre los demás uno
                por uno desde la lista.
              </div>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto border border-border">
                {destinatarios.map((d) => (
                  <li key={d.id}>
                    <a
                      href={buildWhatsAppUrl(
                        d.telefono,
                        renderMensaje(mensaje, d)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 items-center justify-between gap-3 px-4 text-sm transition-colors hover:bg-surface-hover"
                    >
                      <span className="truncate text-text-primary">
                        {d.nombre}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-dato tabular-nums text-brand-green">
                        {d.telefono}
                        <LuExternalLink
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button
                  type="button"
                  loading={confirmando}
                  onClick={() => {
                    if (!campanaId) {
                      onDone();
                      return;
                    }
                    startConfirmar(async () => {
                      await marcarCampanaEnviadaManualAction(campanaId);
                      onDone();
                    });
                  }}
                >
                  Terminar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
