"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const justReset = searchParams.get("reset") === "1";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          STRING<span className="text-brand-green">GYM</span>
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Inicia sesión en tu panel
        </p>
      </div>

      {justReset && (
        <p className="mb-4 rounded-lg border border-brand-green/30 bg-brand-green/10 px-3 py-2.5 text-center text-sm text-text-primary">
          Contraseña actualizada. Inicia sesión con tu nueva contraseña.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-text-secondary"
          >
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            placeholder="tu@correo.com"
          />
        </div>

        <Input
          label="Contraseña"
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="flex items-center text-text-muted hover:text-text-primary"
            >
              {showPassword ? (
                <LuEyeOff className="h-4 w-4" />
              ) : (
                <LuEye className="h-4 w-4" />
              )}
            </button>
          }
        />

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-colors duration-150 hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Entrando…" : "Entrar"}
        </button>

        <p className="text-center">
          <Link
            href="/recuperar-password"
            className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
