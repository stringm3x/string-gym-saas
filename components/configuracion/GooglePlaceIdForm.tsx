"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">
          Reseñas en Google
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Con el Place ID, los miembros que te dan 5 estrellas pueden dejarte
          una reseña en Google. Encuéntralo en Google Maps: busca tu negocio,
          elige Compartir y copia el enlace; el ID está después de{" "}
          <code className="font-mono">place/</code>.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="google_place_id">Google Place ID</Label>
        <div className="flex flex-wrap gap-3">
          <input
            id="google_place_id"
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="ChIJxxxxxxxxxxxxxxxx"
            className="h-11 min-w-0 flex-1 rounded border border-border bg-bg px-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
          <Button type="button" loading={pending} onClick={guardar}>
            Guardar
          </Button>
        </div>
      </div>
    </section>
  );
}
