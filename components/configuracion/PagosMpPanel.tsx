"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCircleCheck, LuCreditCard, LuStore, LuBanknote } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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
    <div className="space-y-6">
      {status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border border-brand-green bg-bg px-5 py-4">
          <div className="flex items-center gap-3">
            <LuCircleCheck
              className="h-5 w-5 shrink-0 text-brand-green"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Conectado
              </p>
              {status.email && (
                <p className="text-xs text-text-secondary">{status.email}</p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={desconectar}
            className="border-danger/40 text-danger hover:border-danger"
          >
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Conecta tu cuenta de MercadoPago
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Pega tu Access Token. Lo obtienes en{" "}
              <a
                href="https://www.mercadopago.com.mx/developers/panel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline underline-offset-4 hover:text-brand-green"
              >
                mercadopago.com.mx/developers/panel
              </a>
              , en tu aplicación, sección Credenciales.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-token">Access Token</Label>
            <input
              id="mp-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="APP_USR-… (o TEST-… para pruebas)"
              className="h-11 w-full rounded border border-border bg-bg px-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <Button
            type="button"
            disabled={!token.trim()}
            loading={pending}
            onClick={guardar}
          >
            {pending ? "Validando…" : "Guardar token"}
          </Button>
        </div>
      )}

      {/* Métodos */}
      <div className="border-t border-border pt-6">
        <p className="mb-3 font-mono text-etiqueta uppercase text-text-secondary">
          Métodos {status.connected ? "activos" : "disponibles"}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: LuCreditCard, label: "Tarjeta" },
            { icon: LuStore, label: "OXXO" },
            { icon: LuBanknote, label: "SPEI" },
          ].map((m) => (
            <div
              key={m.label}
              className={`flex flex-col items-center gap-2 border px-3 py-4 text-sm ${
                status.connected
                  ? "border-brand-green bg-surface-hover text-text-primary"
                  : "border-border bg-transparent text-text-muted"
              }`}
            >
              <m.icon className="h-5 w-5" aria-hidden="true" />
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
