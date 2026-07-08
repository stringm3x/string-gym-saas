"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuMinus, LuSettings2, LuWallet } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/utils/creditos-calc";
import type { MovimientoSaldo } from "@/lib/queries/saldo.queries";
import {
  recargarSaldoAction,
  consumirSaldoAction,
  ajustarSaldoAction,
} from "@/app/(tenant)/[slug]/miembros/[id]/saldo-actions";

type Modo = "recarga" | "consumo" | "ajuste";

const TIPO_LABEL: Record<string, string> = {
  recarga: "Recarga",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

const CONFIG: Record<
  Modo,
  {
    titulo: string;
    accion: (id: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
    permiteNegativo: boolean;
    placeholderConcepto: string;
    okMsg: string;
  }
> = {
  recarga: {
    titulo: "Recargar saldo",
    accion: recargarSaldoAction,
    permiteNegativo: false,
    placeholderConcepto: "Depósito efectivo",
    okMsg: "Saldo recargado",
  },
  consumo: {
    titulo: "Descontar saldo",
    accion: consumirSaldoAction,
    permiteNegativo: false,
    placeholderConcepto: "Proteína ON 2lb",
    okMsg: "Saldo descontado",
  },
  ajuste: {
    titulo: "Ajuste manual",
    accion: ajustarSaldoAction,
    permiteNegativo: true,
    placeholderConcepto: "Corrección de saldo",
    okMsg: "Ajuste aplicado",
  },
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MiembroSaldo({
  miembroId,
  saldo,
  movimientos,
  esOwner,
}: {
  miembroId: string;
  saldo: number;
  movimientos: MovimientoSaldo[];
  esOwner: boolean;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [modo, setModo] = useState<Modo | null>(null);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [pending, start] = useTransition();

  function abrir(m: Modo) {
    setModo(m);
    setMonto("");
    setConcepto("");
  }

  function enviar() {
    if (!modo) return;
    const cfg = CONFIG[modo];
    const n = Number(monto);
    if (!n || Number.isNaN(n)) {
      toastError("Escribe un monto válido");
      return;
    }
    start(async () => {
      const r = await cfg.accion(miembroId, { monto: n, concepto });
      if (!r.ok) {
        toastError("No se pudo aplicar", r.error);
        return;
      }
      success(cfg.okMsg);
      setModo(null);
      router.refresh();
    });
  }

  // Badge de saldo.
  const badge =
    saldo > 0
      ? { cls: "border-brand-green/30 bg-brand-green/10 text-brand-green", txt: `Saldo a favor: ${money(saldo)}` }
      : saldo < 0
        ? { cls: "border-danger/30 bg-danger/10 text-danger", txt: `Debe: ${money(Math.abs(saldo))}` }
        : { cls: "border-border bg-bg text-text-muted", txt: "Sin saldo" };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <LuWallet className="h-4 w-4 text-brand-green" /> Saldo / Crédito
        </h3>
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${badge.cls}`}
        >
          {badge.txt}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => abrir("recarga")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <LuPlus className="h-4 w-4" /> Recargar
        </button>
        <button
          type="button"
          onClick={() => abrir("consumo")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition-colors hover:border-brand-green"
        >
          <LuMinus className="h-4 w-4" /> Descontar
        </button>
        {esOwner && (
          <button
            type="button"
            onClick={() => abrir("ajuste")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <LuSettings2 className="h-4 w-4" /> Ajuste
          </button>
        )}
      </div>

      {/* Historial */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Movimientos
        </p>
        {movimientos.length === 0 ? (
          <p className="text-sm text-text-secondary">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {movimientos.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">
                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                    </span>
                    {m.concepto ? ` · ${m.concepto}` : ""}
                  </p>
                  <p className="text-xs text-text-muted">{fecha(m.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      m.monto >= 0 ? "text-brand-green" : "text-danger"
                    }`}
                  >
                    {m.monto >= 0 ? "+" : "−"}
                    {money(Math.abs(m.monto))}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Saldo: {money(m.saldo_resultante)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {modo && (
        <Modal open onClose={() => setModo(null)} title={CONFIG[modo].titulo} size="sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Monto{CONFIG[modo].permiteNegativo ? " (negativo para restar)" : ""}
              </label>
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Concepto
              </label>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder={CONFIG[modo].placeholderConcepto}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={enviar}
              className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Aplicando…" : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
