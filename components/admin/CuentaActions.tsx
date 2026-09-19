"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
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
          ? { ok: true, text: "Te enviamos un correo para cambiar tu contraseña." }
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
    <div className="space-y-4">
      {msg && (
        <p
          role="status"
          className={`border px-4 py-3 text-sm ${
            msg.ok
              ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={cambiarPassword}>
          Cambiar contraseña
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending}
          onClick={cerrarSesiones}
        >
          Cerrar todas las sesiones
        </Button>
      </div>
    </div>
  );
}
