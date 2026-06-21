"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuLock, LuRotateCcw } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useToast } from "@/components/ui/Toast";
import { MarcaPreview } from "./MarcaPreview";
import {
  updateMarcaAction,
  uploadLogoAction,
  deleteLogoAction,
  type MarcaFormState,
} from "@/app/(tenant)/[slug]/configuracion/marca/actions";
import {
  DEFAULT_COLOR_ACENTO,
  DEFAULT_COLOR_SIDEBAR,
  DEFAULT_COLOR_FONDO,
} from "@/lib/validations/marca.schema";
import { PLAN_LABELS } from "@/lib/features";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

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

const SIDEBAR_PRESETS = ["#141414", "#0a0a0a", "#1e293b", "#1c1917", "#0c1220"];
const FONDO_PRESETS = ["#0a0a0a", "#111827", "#0f172a", "#1a1a1a", "#0c0a09"];

const initialState: MarcaFormState = { ok: false, error: null, fieldErrors: {} };

interface MarcaFormClientProps {
  gymNombre: string;
  logoInicial: string | null;
  colorAcentoInicial: string;
  colorSidebarInicial: string;
  colorFondoInicial: string;
  canColors: boolean;
}

export function MarcaFormClient({
  gymNombre,
  logoInicial,
  colorAcentoInicial,
  colorSidebarInicial,
  colorFondoInicial,
  canColors,
}: MarcaFormClientProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [logoUrl, setLogoUrl] = useState<string | null>(logoInicial);
  const [colorAcento, setColorAcento] = useState(colorAcentoInicial);
  const [colorSidebar, setColorSidebar] = useState(colorSidebarInicial);
  const [colorFondo, setColorFondo] = useState(colorFondoInicial);

  const [state, formAction, isPending] = useActionState(
    updateMarcaAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Colores guardados");
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

  function restaurarDefaults() {
    setColorAcento(DEFAULT_COLOR_ACENTO);
    setColorSidebar(DEFAULT_COLOR_SIDEBAR);
    setColorFondo(DEFAULT_COLOR_FONDO);
  }

  const upgradeUrl = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Hola, soy del gym ${gymNombre} y quiero mejorar a Plan ${PLAN_LABELS.pro} para personalizar los colores de mi marca.`
  )}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {/* Logo */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Logo del gym
            </h3>
            <p className="text-xs text-text-secondary">
              Se muestra en el sidebar, recibos y pantalla de check-in.
            </p>
          </div>
          <FileUpload
            currentUrl={logoUrl}
            onUpload={handleUpload}
            onDelete={handleDelete}
            description="PNG, JPG, SVG o WEBP. Máximo 2MB. Mínimo 512×512px."
          />
        </section>

        {/* Colores */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Colores de marca
            </h3>
            <p className="text-xs text-text-secondary">
              Aplica el color de tu gym a botones, badges y sidebar del sistema.
            </p>
          </div>

          {canColors ? (
            <form action={formAction} className="space-y-4">
              <ColorPicker
                label="Color de acento"
                value={colorAcento}
                onChange={setColorAcento}
                presetColors={PRESETS}
              />
              <ColorPicker
                label="Color del sidebar"
                value={colorSidebar}
                onChange={setColorSidebar}
                presetColors={SIDEBAR_PRESETS}
              />
              <ColorPicker
                label="Color de fondo del contenido"
                value={colorFondo}
                onChange={setColorFondo}
                presetColors={FONDO_PRESETS}
              />

              <input type="hidden" name="color_acento" value={colorAcento} />
              <input type="hidden" name="color_sidebar" value={colorSidebar} />
              <input type="hidden" name="color_fondo" value={colorFondo} />

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<LuRotateCcw className="h-3.5 w-3.5" />}
                  onClick={restaurarDefaults}
                >
                  Restaurar defaults
                </Button>
                <Button type="submit" loading={isPending}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-8 text-center">
              <LuLock className="h-6 w-6 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Colores personalizados
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Disponible en Plan {PLAN_LABELS.pro}. Tu logo sí puedes
                  cambiarlo en cualquier plan.
                </p>
              </div>
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-green/90"
              >
                Mejorar a Plan {PLAN_LABELS.pro}
              </a>
            </div>
          )}
        </section>
      </div>

      {/* Preview en vivo */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <MarcaPreview
          logoUrl={logoUrl}
          colorAcento={canColors ? colorAcento : DEFAULT_COLOR_ACENTO}
          colorSidebar={canColors ? colorSidebar : DEFAULT_COLOR_SIDEBAR}
          colorFondo={canColors ? colorFondo : DEFAULT_COLOR_FONDO}
          gymNombre={gymNombre}
        />
      </div>
    </div>
  );
}
