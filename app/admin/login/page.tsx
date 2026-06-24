"use client";

import { useActionState } from "react";
import { loginAdmin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = { error: null };

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAdmin,
    initialState
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-danger">
            ⚙️ Panel interno
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            STRING<span className="text-danger">ADMIN</span>
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Acceso restringido a administradores de STRING
          </p>
        </div>

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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-danger focus:outline-none"
              placeholder="tu@correo.com"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-text-secondary"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-danger focus:outline-none"
              placeholder="••••••••"
            />
          </div>

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
            className="w-full rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
