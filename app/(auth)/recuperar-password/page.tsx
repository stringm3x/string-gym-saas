"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { solicitarRecuperacion, type RecuperarPasswordState } from "./actions";

const initialState: RecuperarPasswordState = { ok: false, error: null };

export default function RecuperarPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    solicitarRecuperacion,
    initialState
  );

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          STRING<span className="text-brand-green">GYM</span>
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Recupera el acceso a tu cuenta
        </p>
      </div>

      {state.ok ? (
        <div className="space-y-4 text-center">
          <p className="rounded-lg border border-brand-green/30 bg-brand-green/10 px-3 py-2.5 text-sm text-text-primary">
            Te enviamos un email con instrucciones.
          </p>
          <Link
            href="/login"
            className="inline-block text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Input
            label="Correo"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@correo.com"
          />

          {state.error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isPending}>
            Enviar instrucciones
          </Button>

          <p className="text-center">
            <Link
              href="/login"
              className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary"
            >
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
