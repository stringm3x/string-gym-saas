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
import { useToast } from "@/components/ui/Toast";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { enviarCampanaAction } from "@/app/(tenant)/[slug]/comunicaciones/campanas/actions";
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
  return msg.replaceAll("{nombre}", d.nombre).replaceAll("{fecha_vencimiento}", venc);
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
      if (r.enviadoPorApi) {
        // Enviada por la API: no abrimos wa.me.
        setApiSent(true);
        setEnviadosApi(r.enviados ?? 0);
        success(`Campaña enviada por WhatsApp · ${r.enviados} mensajes`);
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
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-green";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2 text-xs">
        {["Audiencia", "Mensaje", "Enviar"].map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const activo = paso === n;
          const hecho = paso > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  activo
                    ? "bg-brand-green text-bg"
                    : hecho
                      ? "bg-brand-green/15 text-brand-green"
                      : "bg-bg text-text-muted"
                }`}
              >
                {hecho ? <LuCheck className="h-3 w-3" /> : n}
              </span>
              <span
                className={activo ? "text-text-primary" : "text-text-secondary"}
              >
                {label}
              </span>
              {n < 3 && <span className="mx-1 h-px w-6 bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Audiencia */}
      {paso === 1 && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {audiencias.map((a) => {
              const sel = audiencia === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudiencia(a.value)}
                  className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    sel
                      ? "border-brand-green bg-brand-green/5"
                      : "border-border hover:border-text-muted"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-text-primary">
                      {a.label}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {a.descripcion}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-green">
                    <LuUsers className="h-3.5 w-3.5" />
                    {a.total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={onDone}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!audiencia || (audData?.total ?? 0) === 0}
              onClick={() => setPaso(2)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Siguiente <LuArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2 — Mensaje */}
      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Nombre de la campaña
            </label>
            <input
              type="text"
              value={nombre}
              maxLength={100}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Recordatorio de renovación"
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">
                Mensaje
              </label>
              <span className="text-[11px] text-text-muted">
                {mensaje.length}/1000
              </span>
            </div>
            <textarea
              value={mensaje}
              maxLength={1000}
              rows={5}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Hola {nombre}, tu membresía vence el {fecha_vencimiento}. ¡Renuévala y sigue entrenando!"
              className={`${inputClass} resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-text-muted">Variables:</span>
              {["{nombre}", "{fecha_vencimiento}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMensaje((m) => m + v)}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-brand-green hover:bg-brand-green/10"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {destinatarios[0] && mensaje && (
            <div className="rounded-lg border border-border bg-bg px-3 py-2">
              <p className="text-[11px] text-text-muted">
                Vista previa · {destinatarios[0].nombre}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
                {renderMensaje(mensaje, destinatarios[0])}
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              <LuArrowLeft className="h-3.5 w-3.5" /> Atrás
            </button>
            <button
              type="button"
              disabled={!nombre.trim() || !mensaje.trim()}
              onClick={() => setPaso(3)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Siguiente <LuArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Paso 3 — Enviar */}
      {paso === 3 && audData && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Audiencia</span>
              <span className="font-medium text-text-primary">
                {audData.label}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-text-secondary">Destinatarios</span>
              <span className="font-semibold text-brand-green">
                {audData.total}
              </span>
            </div>
            {audData.sinTelefono > 0 && (
              <p className="mt-1 text-[11px] text-warning">
                {audData.sinTelefono} sin teléfono — se excluyen del envío.
              </p>
            )}
          </div>

          {!enviada ? (
            <>
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">
                  Primeros destinatarios
                </p>
                <ul className="space-y-1 text-sm text-text-primary">
                  {destinatarios.slice(0, 5).map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span>{d.nombre}</span>
                      <span className="text-text-muted">{d.telefono}</span>
                    </li>
                  ))}
                </ul>
                {destinatarios.length > 5 && (
                  <p className="mt-1 text-xs text-text-muted">
                    y {destinatarios.length - 5} más
                  </p>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setPaso(2)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  <LuArrowLeft className="h-3.5 w-3.5" /> Atrás
                </button>
                <button
                  type="button"
                  disabled={pending || destinatarios.length === 0}
                  onClick={enviar}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <FaWhatsapp className="h-4 w-4" />
                  {pending ? "Enviando…" : "Enviar campaña"}
                </button>
              </div>
            </>
          ) : apiSent ? (
            <>
              <div className="flex items-center gap-1.5 rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-text-primary">
                <LuCircleCheck className="h-4 w-4 shrink-0 text-brand-green" />
                <span>
                  Campaña enviada por WhatsApp a {enviadosApi}{" "}
                  {enviadosApi === 1 ? "contacto" : "contactos"}.
                </span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onDone}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
                >
                  Terminar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-text-primary">
                Campaña registrada. Se abrió el primer chat; abre los demás uno
                por uno desde la lista.
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {destinatarios.map((d) => (
                  <li key={d.id}>
                    <a
                      href={buildWhatsAppUrl(
                        d.telefono,
                        renderMensaje(mensaje, d)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-brand-green"
                    >
                      <span className="text-text-primary">{d.nombre}</span>
                      <span className="inline-flex items-center gap-1.5 text-brand-green">
                        {d.telefono}
                        <LuExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onDone}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
                >
                  Terminar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
