"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCardHeader } from "@/components/layout/AuthShell";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const justReset = searchParams.get("reset") === "1";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <AuthCardHeader
        kicker="Acceso"
        titulo="Entra a tu panel"
        texto="Usa el correo con el que te dieron de alta en tu gimnasio."
      />

      {justReset && (
        <p className="mb-5 border border-brand-green/40 bg-brand-green/10 px-3 py-2.5 text-sm text-text-primary">
          Contraseña actualizada. Inicia sesión con tu nueva contraseña.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Correo"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@gimnasio.mx"
          className="text-base"
        />

        <Input
          label="Contraseña"
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="text-base"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="flex h-9 w-9 items-center justify-center text-text-muted hover:text-text-primary"
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
            className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
        >
          {isPending ? "Entrando…" : "Entrar"}
        </Button>

        <p className="text-center">
          <Link
            href="/recuperar-password"
            className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>

      <div className="mt-8 flex flex-col gap-1.5 border-t border-border pt-6">
        <p className="text-sm text-text-muted">
          ¿Tu gimnasio todavía no usa STRING GYM?
        </p>
        <a
          href="https://stringwebs.com/saas"
          className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          Solicita una prueba de 14 días
        </a>
      </div>
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
