"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCircleCheck, LuCreditCard, LuStore, LuBanknote } from "react-icons/lu";
import {
  guardarMpTokenAction,
  desconectarMpAction,
} from "@/app/(tenant)/[slug]/configuracion/pagos/actions";
import type { MpStatus } from "@/lib/queries/mercadopago.queries";

export function PagosMpPanel({ status }: { status: MpStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);
    start(async () => {
      const r = await guardarMpTokenAction(token);
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      setToken("");
      router.refresh();
    });
  }

  function desconectar() {
    if (!confirm("¿Desconectar MercadoPago? Dejarás de poder cobrar con esta cuenta."))
      return;
    start(async () => {
      await desconectarMpAction();
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {status.connected ? (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LuCircleCheck className="h-5 w-5 text-brand-green" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Conectado
                </p>
                {status.email && (
                  <p className="text-xs text-text-secondary">{status.email}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={desconectar}
              className="rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Conecta tu cuenta de MercadoPago
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Pega tu <strong>Access Token</strong>. Lo obtienes en{" "}
              <a
                href="https://www.mercadopago.com.mx/developers/panel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline"
              >
                mercadopago.com.mx/developers/panel
              </a>{" "}
              → tu aplicación → Credenciales.
            </p>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="APP_USR-… (o TEST-… para pruebas)"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="button"
            disabled={pending || !token.trim()}
            onClick={guardar}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
          >
            {pending ? "Validando…" : "Guardar token"}
          </button>
        </div>
      )}

      {/* Métodos */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Métodos {status.connected ? "activos" : "disponibles"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: LuCreditCard, label: "Tarjeta" },
            { icon: LuStore, label: "OXXO" },
            { icon: LuBanknote, label: "SPEI" },
          ].map((m) => (
            <div
              key={m.label}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs ${
                status.connected
                  ? "border-brand-green/30 bg-brand-green/5 text-text-primary"
                  : "border-border bg-surface text-text-muted"
              }`}
            >
              <m.icon className="h-5 w-5" />
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
