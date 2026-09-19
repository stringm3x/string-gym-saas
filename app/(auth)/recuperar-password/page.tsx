"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCardHeader } from "@/components/layout/AuthShell";
import { solicitarRecuperacion, type RecuperarPasswordState } from "./actions";

const initialState: RecuperarPasswordState = { ok: false, error: null };

export default function RecuperarPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    solicitarRecuperacion,
    initialState
  );

  return (
    <div>
      <AuthCardHeader
        kicker="Acceso"
        titulo="Recupera tu contraseña"
        texto="Te mandamos un correo con un enlace para crear una nueva."
      />

      {state.ok ? (
        <div className="flex flex-col gap-5">
          <p className="border border-brand-green/40 bg-brand-green/10 px-3 py-2.5 text-sm text-text-primary">
            Te enviamos un email con instrucciones.
          </p>
          <Link
            href="/login"
            className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5">
          <Input
            label="Correo"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@gimnasio.mx"
            className="text-base"
          />

          {state.error && (
            <p
              role="alert"
              className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={isPending}>
            Enviar instrucciones
          </Button>

          <p className="text-center">
            <Link
              href="/login"
              className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
