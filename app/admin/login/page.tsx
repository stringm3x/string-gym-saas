"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthShell, AuthCardHeader } from "@/components/layout/AuthShell";
import { loginAdmin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = { error: null };

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAdmin,
    initialState
  );

  return (
    <AuthShell
      marca="STRING · Panel interno"
      lineas={["SOLO PARA", "STRING."]}
      forma="tachon"
      cinta="PANEL INTERNO · STRING"
      lead="Gimnasios, solicitudes de prueba y bitácora de cambios. Acceso restringido a administradores."
    >
      <AuthCardHeader kicker="Panel interno" titulo="Entrar" />

      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Correo"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@stringwebs.com"
          className="text-base"
        />
        <Input
          label="Contraseña"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
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
          {isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
