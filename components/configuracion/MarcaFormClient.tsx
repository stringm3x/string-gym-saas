"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuRotateCcw, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useToast } from "@/components/ui/Toast";
import { contraste } from "@/lib/utils/contraste";
import { MarcaPreview } from "./MarcaPreview";
import {
  updateMarcaAction,
  uploadLogoAction,
  deleteLogoAction,
  type MarcaFormState,
} from "@/app/(tenant)/[slug]/configuracion/marca/actions";
import {
  DEFAULT_COLOR_ACENTO,
  COLOR_TINTA_SOBRE_ACENTO,
} from "@/lib/validations/marca.schema";

const PRESETS = [
  "#50ff05",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#eab308",
  "#14b8a6",
  "#ec4899",
];

const initialState: MarcaFormState = { ok: false, error: null, fieldErrors: {} };

interface MarcaFormClientProps {
  gymNombre: string;
  logoInicial: string | null;
  colorAcentoInicial: string;
}

export function MarcaFormClient({
  gymNombre,
  logoInicial,
  colorAcentoInicial,
}: MarcaFormClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [logoUrl, setLogoUrl] = useState<string | null>(logoInicial);
  const [colorAcento, setColorAcento] = useState(colorAcentoInicial);

  const [state, formAction, isPending] = useActionState(
    updateMarcaAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Color guardado");
      router.refresh();
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state]);

  async function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("logo", file);
    const result = await uploadLogoAction(fd);
    if (!result.ok || !result.url) {
      toastError("Error al subir", result.error ?? "Inténtalo de nuevo.");
      return;
    }
    setLogoUrl(result.url);
    success("Logo actualizado");
    router.refresh();
  }

  async function handleDelete() {
    const result = await deleteLogoAction();
    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudo eliminar.");
      return;
    }
    setLogoUrl(null);
    success("Logo eliminado");
    router.refresh();
  }

  // Único aviso de legibilidad que sigue aplicando sin sidebar/fondo: el
  // acento se usa como fondo de botones (portal/kiosco) con texto oscuro.
  const avisos: string[] = [];
  if (contraste(colorAcento, COLOR_TINTA_SOBRE_ACENTO) < 2.5) {
    avisos.push(
      "El texto oscuro de los botones se leería mal sobre este acento — elige un tono más claro y vivo."
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Logo */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Logo del gimnasio
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Se muestra en el menú, los recibos y la pantalla de check-in.
            </p>
          </div>
          <FileUpload
            currentUrl={logoUrl}
            onUpload={handleUpload}
            onDelete={handleDelete}
            description="PNG, JPG, SVG o WEBP. Máximo 2MB. Mínimo 512×512px."
          />
        </section>

        {/* Color */}
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Color del gimnasio
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Se aplica hacia tu socio: portal, kiosco, QR y recibo. El panel
              interno del staff usa siempre los colores STRING.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <ColorPicker
              label="Color de acento"
              value={colorAcento}
              onChange={setColorAcento}
              presetColors={PRESETS}
            />

            <input type="hidden" name="color_acento" value={colorAcento} />

            {avisos.length > 0 && (
              <div className="space-y-2 border border-warning p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                  <LuTriangleAlert className="h-4 w-4" aria-hidden="true" />
                  Revisa la legibilidad
                </p>
                <ul className="space-y-1 pl-5 text-xs text-text-secondary">
                  {avisos.map((a) => (
                    <li key={a} className="list-disc">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                leftIcon={<LuRotateCcw className="h-4 w-4" />}
                onClick={() => setColorAcento(DEFAULT_COLOR_ACENTO)}
              >
                Restaurar verde STRING
              </Button>
              <Button type="submit" loading={isPending}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </section>
      </div>

      {/* Preview en vivo */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <MarcaPreview
          logoUrl={logoUrl}
          colorAcento={colorAcento}
          gymNombre={gymNombre}
        />
      </div>
    </div>
  );
}
