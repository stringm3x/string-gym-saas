"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Estado = "verificando" | "listo" | "invalido" | "guardando";

function NuevaPasswordInner() {
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>("verificando");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Capturar los params del link ANTES de crear el client (detectSessionInUrl
    // puede consumir/limpiar el hash al inicializar).
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const search = new URL(window.location.href).searchParams;

    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const tokenHash = search.get("token_hash");
    const type = search.get("type");
    const code = search.get("code");
    const errDesc =
      hashParams.get("error_description") ?? search.get("error_description");

    const supabase = createClient();

    (async () => {
      if (errDesc) {
        setEstado("invalido");
        return;
      }

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else if (tokenHash && type) {
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setEstado("invalido");
        return;
      }

      setEstado("listo");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEstado("guardando");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setEstado("listo");
      return;
    }

    router.push("/login?reset=1");
  }

  if (estado === "verificando") {
    return <p className="text-sm text-text-secondary">Validando enlace…</p>;
  }

  if (estado === "invalido") {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="space-y-1.5">
          <p className="text-base font-medium text-text-primary">
            Enlace inválido o expirado
          </p>
          <p className="text-sm text-text-secondary">
            Vuelve a solicitar la recuperación de contraseña.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => router.push("/recuperar-password")}
        >
          Solicitar de nuevo
        </Button>
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
          Crea tu nueva contraseña
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nueva contraseña"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          description="Mínimo 8 caracteres"
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
        <Input
          label="Confirmar contraseña"
          type={showConfirm ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="flex items-center text-text-muted hover:text-text-primary"
            >
              {showConfirm ? (
                <LuEyeOff className="h-4 w-4" />
              ) : (
                <LuEye className="h-4 w-4" />
              )}
            </button>
          }
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={estado === "guardando"}
        >
          Guardar contraseña
        </Button>
      </form>
    </div>
  );
}

export default function NuevaPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Suspense
        fallback={<p className="text-sm text-text-secondary">Cargando…</p>}
      >
        <NuevaPasswordInner />
      </Suspense>
    </div>
  );
}
