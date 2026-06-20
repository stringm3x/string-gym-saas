"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { acceptInviteAction, checkInviteStatusAction } from "./actions";

type Estado = "verificando" | "listo" | "invalido" | "guardando";

interface InvalidInfo {
  title: string;
  message: string;
  showSignOut?: boolean;
  showLogin?: boolean;
}

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
  const [invalid, setInvalid] = useState<InvalidInfo | null>(null);

  useEffect(() => {
    if (!staffId) {
      setInvalid({
        title: "Invitación no válida",
        message: "Falta información en el enlace.",
      });
      setEstado("invalido");
      return;
    }

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

    const hasInviteTokens = Boolean(access_token || tokenHash || code);

    const supabase = createClient();

    function fail(info: InvalidInfo) {
      setInvalid(info);
      setEstado("invalido");
    }

    /** Resuelve el mensaje correcto cuando no se puede continuar. */
    async function explainAndFail(fallbackDebug?: string) {
      const status = await checkInviteStatusAction(staffId!);
      if (!status.exists) {
        fail({
          title: "Invitación no disponible",
          message: "Esta invitación fue cancelada o ya fue usada.",
        });
        return;
      }
      if (status.alreadyActive) {
        fail({
          title: "Invitación ya aceptada",
          message:
            "Esta invitación ya fue aceptada. Inicia sesión normalmente.",
          showLogin: true,
        });
        return;
      }
      if (status.hasSession && !status.userIdMatches) {
        fail({
          title: "Sesión de otra cuenta",
          message:
            "Estás logueado con otra cuenta. Cierra sesión y vuelve a hacer click en el link del email.",
          showSignOut: true,
        });
        return;
      }
      fail({
        title: "No pudimos validar el enlace",
        message:
          fallbackDebug ??
          "El enlace expiró o ya fue usado. Pide que te reenvíen la invitación.",
      });
    }

    (async () => {
      // Error explícito en el link (expirado/usado).
      if (errDesc) {
        fail({
          title: "Enlace expirado",
          message: errDesc.replace(/\+/g, " "),
        });
        return;
      }

      // Si el link trae tokens de invitación, limpiar cualquier sesión previa
      // (ej. el owner logueado) ANTES de establecer la del invitado.
      if (hasInviteTokens) {
        const {
          data: { session: prev },
        } = await supabase.auth.getSession();
        if (prev) {
          await supabase.auth.signOut({ scope: "local" });
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
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const presentes = [
          access_token && "hash:access_token",
          tokenHash && "query:token_hash",
          code && "query:code",
        ]
          .filter(Boolean)
          .join(", ");
        await explainAndFail(
          hasInviteTokens
            ? `No se pudo establecer la sesión. Params: ${presentes}.`
            : undefined
        );
        return;
      }

      // Leer el propio registro staff (RLS de auto-lectura) para prellenar.
      const { data: staffRow } = await supabase
        .from("staff")
        .select("nombre, estado, user_id")
        .eq("id", staffId)
        .maybeSingle();

      if (!staffRow) {
        // No legible con la sesión actual → distinguir caso real con admin.
        await explainAndFail();
        return;
      }
      if (staffRow.user_id !== session.user.id) {
        fail({
          title: "Sesión de otra cuenta",
          message:
            "Estás logueado con otra cuenta. Cierra sesión y vuelve a hacer click en el link del email.",
          showSignOut: true,
        });
        return;
      }
      if (staffRow.estado === "activo") {
        fail({
          title: "Invitación ya aceptada",
          message:
            "Esta invitación ya fue aceptada. Inicia sesión normalmente.",
          showLogin: true,
        });
        return;
      }

      setNombre(staffRow.nombre ?? "");
      setEstado("listo");
    })();
  }, [staffId]);

  async function handleSignOutRetry() {
    setEstado("verificando");
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    // Recarga con los mismos params; el flujo vuelve a correr con sesión limpia.
    window.location.reload();
  }

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
    return <p className="text-sm text-text-secondary">Validando invitación…</p>;
  }

  if (estado === "invalido" && invalid) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="space-y-1.5">
          <p className="text-base font-medium text-text-primary">
            {invalid.title}
          </p>
          <p className="text-sm text-text-secondary">{invalid.message}</p>
        </div>
        {invalid.showSignOut && (
          <Button className="w-full" onClick={handleSignOutRetry}>
            Cerrar sesión y reintentar
          </Button>
        )}
        {invalid.showLogin && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.location.assign("/login")}
          >
            Ir a iniciar sesión
          </Button>
        )}
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

        <Button type="submit" className="w-full" loading={estado === "guardando"}>
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
        fallback={<p className="text-sm text-text-secondary">Cargando…</p>}
      >
        <AcceptInviteInner />
      </Suspense>
    </div>
  );
}
