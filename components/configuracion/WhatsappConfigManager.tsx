"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  updateWhatsappConfigAction,
  type WhatsappConfigFormState,
} from "@/app/(tenant)/[slug]/configuracion/whatsapp/actions";
import type { WhatsappConfig } from "@/lib/queries/gyms.queries";

const initialState: WhatsappConfigFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

interface WhatsappConfigManagerProps {
  config: WhatsappConfig;
}

export function WhatsappConfigManager({ config }: WhatsappConfigManagerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    updateWhatsappConfigAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Configuración guardada");
      router.refresh();
    }
  }, [state.ok]);

  useEffect(() => {
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state.error]);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <Input
        label="Número de WhatsApp"
        name="numero"
        defaultValue={config.numero ?? ""}
        placeholder="+521XXXXXXXXXX"
        description="En formato internacional (E.164)."
        error={state.fieldErrors.numero}
      />

      <Input
        label="API key de 360dialog"
        name="api_key"
        type="password"
        defaultValue=""
        placeholder={
          config.apiKeySet ? "•••••••• (guardada)" : "Pega tu API key"
        }
        description={
          config.apiKeySet
            ? "Ya hay una API key guardada. Déjalo en blanco para conservarla."
            : "La API key de tu subcuenta de 360dialog."
        }
        error={state.fieldErrors.api_key}
      />

      <div className="space-y-2">
        <Label htmlFor="alerta_visitas_umbral">Alerta de visitas bajas</Label>
        <input
          id="alerta_visitas_umbral"
          type="number"
          name="alerta_visitas_umbral"
          min="0"
          step="1"
          defaultValue={config.alertaVisitasUmbral}
          className="h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        <p className="text-xs text-text-muted">
          Avisa al socio por WhatsApp cuando sus visitas restantes lleguen a
          este número (planes por visitas). 0 = desactivado.
        </p>
      </div>

      <label className="flex items-start gap-3 border border-border p-4">
        <input
          type="checkbox"
          name="activo"
          value="true"
          defaultChecked={config.activo}
          className="mt-0.5 h-4 w-4 accent-brand-green"
        />
        <span>
          <span className="block text-sm font-medium text-text-primary">
            WhatsApp activo
          </span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            Enciende el envío de mensajes, el bot y el inbox. Requiere número y
            API key configurados.
          </span>
        </span>
      </label>

      {state.error && Object.keys(state.fieldErrors).length === 0 && (
        <p className="border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
