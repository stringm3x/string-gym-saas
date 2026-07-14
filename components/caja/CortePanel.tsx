"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuLockOpen, LuLock, LuHistory } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { CorteAbierto, CorteTotales } from "@/lib/queries/cortes.queries";
import {
  abrirCorteAction,
  cerrarCorteAction,
} from "@/app/(tenant)/[slug]/caja/corte-actions";

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

interface CortePanelProps {
  slug: string;
  corte: CorteAbierto | null;
  totales: CorteTotales | null;
}

export function CortePanel({ slug, corte, totales }: CortePanelProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {corte ? (
            <LuLockOpen className="h-4 w-4 text-brand-green" />
          ) : (
            <LuLock className="h-4 w-4 text-text-muted" />
          )}
          Corte de caja
        </h3>
        <Link
          href={`/${slug}/caja/cortes`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-brand-green"
        >
          <LuHistory className="h-3.5 w-3.5" /> Historial
        </Link>
      </div>

      {corte ? (
        <CorteAbiertoView corte={corte} totales={totales} />
      ) : (
        <AbrirCorte />
      )}
    </div>
  );
}

function AbrirCorte() {
  const router = useRouter();
  const { error: toastError, success } = useToast();
  const [fondo, setFondo] = useState("");
  const [pending, start] = useTransition();

  function abrir() {
    const monto = Number(fondo || 0);
    start(async () => {
      const r = await abrirCorteAction(monto);
      if (!r.ok) {
        toastError("No se pudo abrir", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Turno abierto");
      setFondo("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        No hay ningún turno abierto. Abre uno con el efectivo con el que arrancas
        el cajón.
      </p>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
            Fondo inicial (efectivo)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
        </label>
        <Button type="button" onClick={abrir} loading={pending}>
          Abrir turno
        </Button>
      </div>
    </div>
  );
}

function CorteAbiertoView({
  corte,
  totales,
}: {
  corte: CorteAbierto;
  totales: CorteTotales | null;
}) {
  const router = useRouter();
  const { error: toastError, success } = useToast();
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [pending, start] = useTransition();

  const t = totales ?? {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    cantidad: 0,
    reembolsosEfectivo: 0,
  };
  const esperado = corte.fondo_inicial + t.efectivo - t.reembolsosEfectivo;
  const contadoNum = contado.trim() === "" ? null : Number(contado);
  const diferencia = contadoNum === null ? null : contadoNum - esperado;

  function cerrar() {
    if (contadoNum === null || !Number.isFinite(contadoNum)) {
      toastError("Falta el conteo", "Escribe el efectivo contado en el cajón.");
      return;
    }
    start(async () => {
      const r = await cerrarCorteAction(corte.id, contadoNum, notas);
      if (!r.ok) {
        toastError("No se pudo cerrar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success(
        "Turno cerrado",
        `Diferencia: ${formatMoneda(r.diferencia ?? 0)}`
      );
      setContado("");
      setNotas("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Abierto por{" "}
        <span className="text-text-primary">
          {corte.abierto_por_nombre ?? "—"}
        </span>{" "}
        a las {hora(corte.abierto_at)} · Fondo inicial{" "}
        {formatMoneda(corte.fondo_inicial)}
      </p>

      {/* Totales del turno */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tot label="Efectivo" valor={t.efectivo} acento />
        <Tot label="Tarjeta" valor={t.tarjeta} />
        <Tot label="Transferencia" valor={t.transferencia} />
        <Tot label="Total turno" valor={t.total} />
      </div>

      {/* Cierre */}
      <div className="space-y-3 border-t border-border pt-4">
        {t.reembolsosEfectivo > 0 && (
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Reembolsos en efectivo</span>
            <span className="font-mono text-danger">
              −{formatMoneda(t.reembolsosEfectivo)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Esperado en cajón</span>
          <span className="font-mono font-semibold text-text-primary">
            {formatMoneda(esperado)}
          </span>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
              Efectivo contado
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
          </label>
        </div>

        {diferencia !== null && (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              diferencia === 0
                ? "bg-brand-green/10 text-brand-green"
                : diferencia < 0
                  ? "bg-danger/10 text-danger"
                  : "bg-warning/10 text-warning"
            )}
          >
            <span>
              {diferencia === 0
                ? "Cuadra exacto"
                : diferencia < 0
                  ? "Faltante"
                  : "Sobrante"}
            </span>
            <span className="font-mono font-semibold">
              {formatMoneda(Math.abs(diferencia))}
            </span>
          </div>
        )}

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Notas del cierre (opcional)…"
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />

        <Button
          type="button"
          onClick={cerrar}
          loading={pending}
          className="w-full"
        >
          Cerrar turno
        </Button>
      </div>
    </div>
  );
}

function Tot({
  label,
  valor,
  acento = false,
}: {
  label: string;
  valor: number;
  acento?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          acento ? "text-brand-green" : "text-text-primary"
        )}
      >
        {formatMoneda(valor)}
      </p>
    </div>
  );
}
