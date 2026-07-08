"use client";

import { useState, useTransition } from "react";
import { LuArrowLeft, LuCheck } from "react-icons/lu";
import { KioscoScan } from "./KioscoScan";
import { CodigoAutorizacion } from "./CodigoAutorizacion";
import {
  identificarMembresiaKioscoAction,
  crearCodigoMembresiaAction,
  renovarMembresiaMpKioscoAction,
} from "@/app/kiosco/[slug]/actions";
import type { KioscoPlan } from "@/lib/queries/kiosco.queries";

type Paso = "scan" | "estado" | "planes" | "metodo" | "codigo" | "mp";
type Miembro = { id: string; nombre: string; fecha_vencimiento: string | null };

function pesos(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function fechaLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function diasRestantes(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + "T00:00:00");
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
}

export function KioscoMembresia({ slug }: { slug: string }) {
  const [paso, setPaso] = useState<Paso>("scan");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [miembro, setMiembro] = useState<Miembro | null>(null);
  const [planes, setPlanes] = useState<KioscoPlan[]>([]);
  const [mpDisponible, setMpDisponible] = useState(false);
  const [planSel, setPlanSel] = useState<KioscoPlan | null>(null);
  const [codigo, setCodigo] = useState<{ codigo: string; expiraAt: string } | null>(
    null
  );
  const [mpInit, setMpInit] = useState<string | null>(null);

  function identificar(token: string) {
    setError(null);
    start(async () => {
      const r = await identificarMembresiaKioscoAction(slug, token);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMiembro(r.miembro);
      setPlanes(r.planes);
      setMpDisponible(r.mpDisponible);
      setPaso("estado");
    });
  }

  function elegirPlan(p: KioscoPlan) {
    setPlanSel(p);
    setError(null);
    setPaso("metodo");
  }

  function pagar(metodo: "efectivo" | "transferencia") {
    if (!miembro || !planSel) return;
    setError(null);
    start(async () => {
      const r = await crearCodigoMembresiaAction(
        slug,
        miembro.id,
        planSel.id,
        metodo
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCodigo({ codigo: r.codigo, expiraAt: r.expiraAt });
      setPaso("codigo");
    });
  }

  function pagarMp() {
    if (!miembro || !planSel) return;
    setError(null);
    start(async () => {
      const r = await renovarMembresiaMpKioscoAction(slug, miembro.id, planSel.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMpInit(r.initPoint);
      setPaso("mp");
    });
  }

  function reset() {
    setPaso("scan");
    setMiembro(null);
    setPlanes([]);
    setPlanSel(null);
    setCodigo(null);
    setMpInit(null);
    setError(null);
  }

  // ---- Scan ----
  if (paso === "scan") {
    return (
      <KioscoScan
        titulo="Escanea tu QR para pagar tu membresía"
        onToken={identificar}
        pending={pending}
        error={error}
      />
    );
  }

  // ---- Código de autorización ----
  if (paso === "codigo" && codigo) {
    return (
      <CodigoAutorizacion
        codigo={codigo.codigo}
        expiraAt={codigo.expiraAt}
        mensaje={`${miembro?.nombre}, muestra este código en el mostrador para que el staff autorice tu pago.`}
        onReset={reset}
      />
    );
  }

  // ---- MercadoPago ----
  if (paso === "mp" && mpInit) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border border-brand-green/40 bg-brand-green/10 p-12 text-center">
        <LuCheck className="h-16 w-16 text-brand-green" />
        <p className="text-2xl font-semibold text-text-primary">
          Continúa tu pago con MercadoPago
        </p>
        <p className="text-lg text-text-secondary">
          Al terminar, tu membresía se renueva automáticamente.
        </p>
        <button
          type="button"
          onClick={() => window.open(mpInit, "_blank", "noopener,noreferrer")}
          className="rounded-2xl bg-brand-green px-8 py-4 text-lg font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Abrir pago
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-lg text-text-secondary hover:text-text-primary"
        >
          Listo
        </button>
      </div>
    );
  }

  // ---- Estado de la membresía ----
  if (paso === "estado" && miembro) {
    const venc = miembro.fecha_vencimiento;
    const dias = venc ? diasRestantes(venc) : null;
    let color = "border-brand-green/40 bg-brand-green/10 text-brand-green";
    let titulo: string;
    let cta: string;

    if (dias === null) {
      color = "border-warning/40 bg-warning/10 text-warning";
      titulo = "No tienes una membresía registrada.";
      cta = "Contratar membresía";
    } else if (dias < 0) {
      color = "border-danger/40 bg-danger/10 text-danger";
      titulo = `Tu membresía venció el ${fechaLarga(venc!)}.`;
      cta = "Renovar ahora";
    } else if (dias <= 7) {
      color = "border-warning/40 bg-warning/10 text-warning";
      titulo =
        dias === 0
          ? "Tu membresía vence hoy."
          : `Tu membresía vence en ${dias} día${dias === 1 ? "" : "s"}.`;
      cta = "Renovar ahora";
    } else {
      titulo = `Tu membresía está activa hasta el ${fechaLarga(venc!)}.`;
      cta = "Renovar anticipadamente";
    }

    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <button
          type="button"
          onClick={reset}
          className="self-start inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" /> Cambiar miembro
        </button>

        <div
          className={`flex w-full flex-col items-center gap-3 rounded-3xl border p-10 text-center ${color}`}
        >
          <p className="text-lg font-semibold text-text-secondary">
            Hola, {miembro.nombre}
          </p>
          <p className="text-2xl font-bold text-text-primary">{titulo}</p>
          {dias !== null && dias >= 0 && (
            <p className="text-lg text-text-secondary">
              Te queda{dias === 1 ? "" : "n"} {dias} día{dias === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setPaso("planes");
          }}
          className="rounded-2xl bg-brand-green px-8 py-4 text-lg font-semibold text-bg transition-opacity hover:opacity-90"
        >
          {cta}
        </button>
      </div>
    );
  }

  // ---- Selección de plan ----
  if (paso === "planes") {
    return (
      <div className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto py-4">
        <button
          type="button"
          onClick={() => setPaso("estado")}
          className="self-start inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" /> Atrás
        </button>
        <p className="text-center text-2xl font-semibold text-text-primary">
          Elige tu plan
        </p>
        {planes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-lg text-text-secondary">
            No hay planes disponibles en este momento.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {planes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegirPlan(p)}
                className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-brand-green"
              >
                <span className="text-xl font-semibold text-text-primary">
                  {p.nombre}
                </span>
                <span className="text-2xl font-bold text-brand-green">
                  {pesos(p.precio)}
                </span>
                <span className="text-sm text-text-secondary">
                  {p.dias_duracion} días
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Método de pago ----
  if (paso === "metodo" && planSel) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <button
          type="button"
          onClick={() => setPaso("planes")}
          className="self-start inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" /> Atrás
        </button>

        <div className="w-full rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-lg text-text-secondary">{planSel.nombre}</p>
          <p className="text-3xl font-bold text-text-primary">
            {pesos(planSel.precio)}
          </p>
        </div>

        <p className="text-xl font-semibold text-text-primary">
          ¿Cómo quieres pagar?
        </p>

        {error && (
          <p className="text-center text-base font-medium text-danger">{error}</p>
        )}

        <div className="grid w-full gap-3">
          <button
            type="button"
            onClick={() => pagar("efectivo")}
            disabled={pending}
            className="rounded-2xl border border-border bg-surface px-6 py-4 text-lg font-semibold text-text-primary transition-colors hover:border-brand-green disabled:opacity-40"
          >
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => pagar("transferencia")}
            disabled={pending}
            className="rounded-2xl border border-border bg-surface px-6 py-4 text-lg font-semibold text-text-primary transition-colors hover:border-brand-green disabled:opacity-40"
          >
            Transferencia
          </button>
          {mpDisponible && (
            <button
              type="button"
              onClick={pagarMp}
              disabled={pending}
              className="rounded-2xl bg-brand-green px-6 py-4 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Pagar con tarjeta / OXXO / SPEI
            </button>
          )}
        </div>

        {pending && (
          <p className="text-lg text-text-muted">Procesando…</p>
        )}
      </div>
    );
  }

  return null;
}
