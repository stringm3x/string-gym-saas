"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuLock, LuRotateCcw, LuTriangleAlert, LuCheck } from "react-icons/lu";
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
  DEFAULT_COLOR_SIDEBAR,
  DEFAULT_COLOR_FONDO,
  COLOR_TINTA,
  COLOR_TINTA_SOBRE_ACENTO,
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

const SIDEBAR_PRESETS = [DEFAULT_COLOR_SIDEBAR, DEFAULT_COLOR_FONDO, "#1e293b", "#1c1917", "#0c1220"];
const FONDO_PRESETS = [DEFAULT_COLOR_FONDO, "#111827", "#0f172a", "#1a1a1a", "#0c0a09"];

// Temas curados: paletas cohesivas (acento + sidebar + fondo) de un clic.
const TEMAS = [
  { nombre: "STRING", acento: DEFAULT_COLOR_ACENTO, sidebar: DEFAULT_COLOR_SIDEBAR, fondo: DEFAULT_COLOR_FONDO },
  { nombre: "Medianoche", acento: "#3b82f6", sidebar: "#0f172a", fondo: "#0b1120" },
  { nombre: "Esmeralda", acento: "#10b981", sidebar: "#0c1a14", fondo: "#071310" },
  { nombre: "Vino", acento: "#fb7185", sidebar: "#1a0f13", fondo: "#140b0e" },
  { nombre: "Grafito", acento: "#f97316", sidebar: "#171717", fondo: "#0c0a09" },
  { nombre: "Violeta", acento: "#a855f7", sidebar: "#171325", fondo: "#100b1c" },
] as const;

// Referencias de texto que usa el sistema, para chequear legibilidad.
const TEXTO_CLARO = COLOR_TINTA; // texto sobre sidebar/fondo
const TEXTO_BOTON = COLOR_TINTA_SOBRE_ACENTO; // texto oscuro sobre el acento (botones)

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

  function aplicarTema(t: (typeof TEMAS)[number]) {
    setColorAcento(t.acento);
    setColorSidebar(t.sidebar);
    setColorFondo(t.fondo);
  }

  const temaActivo = TEMAS.find(
    (t) =>
      t.acento.toLowerCase() === colorAcento.toLowerCase() &&
      t.sidebar.toLowerCase() === colorSidebar.toLowerCase() &&
      t.fondo.toLowerCase() === colorFondo.toLowerCase()
  );

  // Avisos de legibilidad (WCAG-ish). No bloquean; solo orientan.
  const avisos: string[] = [];
  if (contraste(colorAcento, colorFondo) < 2.2) {
    avisos.push(
      "El color de acento casi no se distingue del fondo del contenido."
    );
  }
  if (contraste(colorAcento, TEXTO_BOTON) < 2.5) {
    avisos.push(
      "El texto oscuro de los botones se leería mal sobre el acento — elige un acento más claro y vivo."
    );
  }
  if (contraste(TEXTO_CLARO, colorSidebar) < 3.5) {
    avisos.push(
      "El texto del menú se leería mal sobre el sidebar — usa un tono más oscuro."
    );
  }
  if (contraste(TEXTO_CLARO, colorFondo) < 3.5) {
    avisos.push(
      "El contenido se leería mal sobre este fondo — usa un tono más oscuro."
    );
  }

  const upgradeUrl = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Hola, soy del gym ${gymNombre} y quiero mejorar a Plan ${PLAN_LABELS.pro} para personalizar los colores de mi marca.`
  )}`;

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

        {/* Colores */}
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Colores de marca
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Aplica el color de tu gimnasio a botones, etiquetas y menú del
              sistema.
            </p>
          </div>

          {canColors ? (
            <form action={formAction} className="space-y-4">
              {/* Temas curados: un clic aplica los tres colores. */}
              <div className="space-y-2">
                <p className="font-mono text-etiqueta uppercase text-text-secondary">
                  Temas rápidos
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {TEMAS.map((t) => {
                    const activo = temaActivo?.nombre === t.nombre;
                    return (
                      <button
                        key={t.nombre}
                        type="button"
                        onClick={() => aplicarTema(t)}
                        aria-pressed={activo}
                        title={t.nombre}
                        className={
                          "relative flex flex-col items-center gap-1.5 border p-2 transition-colors " +
                          (activo
                            ? "border-brand-green bg-surface-hover"
                            : "border-border hover:border-text-secondary")
                        }
                      >
                        <span
                          className="flex h-8 w-full items-center justify-end gap-1 overflow-hidden px-1.5"
                          style={{ backgroundColor: t.fondo }}
                        >
                          <span
                            className="absolute left-0 top-0 h-full w-2.5"
                            style={{ backgroundColor: t.sidebar }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: t.acento }}
                          />
                        </span>
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            activo
                              ? "font-semibold text-brand-green"
                              : "text-text-secondary"
                          }`}
                        >
                          {activo && (
                            <LuCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {t.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-text-muted">
                  ¿Quieres afinar? Ajusta cada color abajo.
                </p>
              </div>

              <ColorPicker
                label="Color de acento"
                value={colorAcento}
                onChange={setColorAcento}
                presetColors={PRESETS}
              />
              <ColorPicker
                label="Color del menú lateral"
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
                  onClick={restaurarDefaults}
                >
                  Restaurar colores STRING
                </Button>
                <Button type="submit" loading={isPending}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4 border border-dashed border-border px-5 py-8 text-center">
              <LuLock className="h-6 w-6 text-text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Colores personalizados
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Disponible en Plan {PLAN_LABELS.pro}. Tu logo sí puedes
                  cambiarlo en cualquier plan.
                </p>
              </div>
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
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
