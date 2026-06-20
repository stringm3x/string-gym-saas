"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { acceptInviteAction } from "./actions";

type Estado = "verificando" | "listo" | "invalido" | "guardando";

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const staffId = searchParams.get("staff_id");

  const [estado, setEstado] = useState<Estado>("verificando");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string>>
  >({});

  useEffect(() => {
    if (!staffId) {
      setEstado("invalido");
      return;
    }

    const supabase = createClient();

    (async () => {
      // El client de browser auto-detecta la sesión del hash del link.
      let {
        data: { session },
      } = await supabase.auth.getSession();

      // Fallbacks: token_hash (verifyOtp) o code (PKCE).
      if (!session) {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const code = url.searchParams.get("code");
        if (tokenHash && type) {
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }

      if (!session) {
        setEstado("invalido");
        return;
      }

      // Leer el propio registro staff (RLS de auto-lectura) para prellenar.
      const { data: staffRow } = await supabase
        .from("staff")
        .select("nombre, estado, user_id")
        .eq("id", staffId)
        .maybeSingle();

      if (!staffRow || staffRow.user_id !== session.user.id) {
        setEstado("invalido");
        return;
      }

      setNombre(staffRow.nombre ?? "");
      setEstado("listo");
    })();
  }, [staffId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ password: "Las contraseñas no coinciden." });
      return;
    }

    setEstado("guardando");
    const result = await acceptInviteAction(staffId!, nombre, password);

    if (!result.ok) {
      setError(result.error ?? "No se pudo completar.");
      setFieldErrors(result.fieldErrors ?? {});
      setEstado("listo");
      return;
    }

    // Recarga completa para entrar con la sesión ya activada.
    window.location.assign(result.slug ? `/${result.slug}/checkins` : "/login");
  }

  if (estado === "verificando") {
    return (
      <p className="text-sm text-text-secondary">Validando invitación…</p>
    );
  }

  if (estado === "invalido") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-base font-medium text-text-primary">
          Invitación no válida o expirada
        </p>
        <p className="text-sm text-text-secondary">
          Pídele al dueño del gimnasio que te reenvíe la invitación.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          STRING<span className="text-brand-green">GYM</span>
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Crea tu contraseña para acceder
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          error={fieldErrors.nombre}
        />
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          error={fieldErrors.password}
          description="Mínimo 8 caracteres"
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={estado === "guardando"}
        >
          Crear contraseña y entrar
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Suspense
        fallback={
          <p className="text-sm text-text-secondary">Cargando…</p>
        }
      >
        <AcceptInviteInner />
      </Suspense>
    </div>
  );
}
