"use client";

import { useState, useTransition } from "react";
import {
  cambiarPasswordAction,
  cerrarTodasSesionesAction,
} from "@/app/admin/(panel)/cuenta/actions";

export function CuentaActions() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function cambiarPassword() {
    setMsg(null);
    start(async () => {
      const r = await cambiarPasswordAction();
      setMsg(
        r.ok
          ? { ok: true, text: "Te enviamos un email para cambiar tu contraseña." }
          : { ok: false, text: r.error ?? "Error" }
      );
    });
  }

  function cerrarSesiones() {
    if (!confirm("¿Cerrar todas tus sesiones en todos los dispositivos?")) return;
    start(async () => {
      await cerrarTodasSesionesAction();
    });
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            msg.ok
              ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={cambiarPassword}
          className="rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
        >
          Cambiar contraseña
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={cerrarSesiones}
          className="rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          Cerrar todas las sesiones
        </button>
      </div>
    </div>
  );
}
