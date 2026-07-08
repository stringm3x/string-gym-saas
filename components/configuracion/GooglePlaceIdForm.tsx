"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { guardarGooglePlaceIdAction } from "@/app/(tenant)/[slug]/configuracion/marca/actions";

export function GooglePlaceIdForm({ inicial }: { inicial: string }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [valor, setValor] = useState(inicial);
  const [pending, start] = useTransition();

  function guardar() {
    start(async () => {
      const r = await guardarGooglePlaceIdAction(valor);
      if (!r.ok) {
        toastError("No se pudo guardar", r.error);
        return;
      }
      success("Google Place ID guardado");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <label
        htmlFor="google_place_id"
        className="block text-sm font-medium text-text-primary"
      >
        Google Place ID
      </label>
      <p className="mt-1 text-xs text-text-secondary">
        Encuéntralo en Google Maps → busca tu negocio → Compartir → copiar link →
        el ID está en el link después de <code>place/</code>. Con esto, los
        miembros que dan 5★ pueden dejarte una reseña en Google.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id="google_place_id"
          type="text"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="ChIJxxxxxxxxxxxxxxxx"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
        />
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
