"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuPhone,
  LuMessageCircle,
  LuMail,
  LuCheck,
  LuChevronDown,
  LuLogIn,
} from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import { registrarAccionAction } from "@/app/(tenant)/[slug]/notas/actions";
import { compilarPlantilla } from "@/lib/utils/plantilla";
import { normalizarTelefonoMx } from "@/lib/utils/whatsapp";
import type { PlantillaMensaje, PlantillaCategoria } from "@/lib/queries/plantillas.queries";

const CATEGORIAS_MIEMBRO: PlantillaCategoria[] = [
  "miembro_activo",
  "miembro_por_vencer",
  "miembro_vencido",
  "general",
];
const CATEGORIAS_PROSPECTO: PlantillaCategoria[] = ["prospecto", "general"];

interface AccionesRapidasProps {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  fechaVencimiento?: string | null;
  gymNombre?: string;
  entidadTipo: "miembro" | "prospecto";
  entidadId: string;
  plantillas?: PlantillaMensaje[];
  /** URL de login al portal del miembro — si viene, muestra el botón "Portal". */
  portalUrl?: string | null;
  /** "WhatsApp manual a un clic" es Pro (feature whatsapp_manual). */
  canWhatsapp?: boolean;
}

export function AccionesRapidas({
  nombre,
  telefono,
  email,
  fechaVencimiento,
  gymNombre,
  entidadTipo,
  entidadId,
  plantillas = [],
  portalUrl,
  canWhatsapp = true,
}: AccionesRapidasProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const categorias =
    entidadTipo === "miembro" ? CATEGORIAS_MIEMBRO : CATEGORIAS_PROSPECTO;
  const plantillasFiltradas = plantillas.filter((p) =>
    categorias.includes(p.categoria)
  );

  const context = {
    nombre,
    fecha_vencimiento: fechaVencimiento ?? undefined,
    gym_nombre: gymNombre,
  };

  async function registrar(
    contenido: string,
    tipoAccion: "llamada" | "whatsapp" | "email" | "otro"
  ) {
    const result = await registrarAccionAction(
      entidadTipo,
      entidadId,
      contenido,
      tipoAccion
    );
    if (result.ok) {
      router.refresh();
    } else {
      toastError("Error", result.error ?? "No se pudo registrar la acción");
    }
  }

  function handleLlamar() {
    if (!telefono) return;
    window.open(`tel:${telefono}`, "_self");
    registrar("Llamada iniciada", "llamada");
    success("Llamada registrada");
  }

  async function handleWhatsApp(plantilla?: PlantillaMensaje) {
    if (!telefono) return;
    setShowPlantillas(false);

    const mensaje = plantilla
      ? compilarPlantilla(plantilla.contenido, context)
      : "";
    const numero = normalizarTelefonoMx(telefono);
    const url = mensaje
      ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/${numero}`;

    window.open(url, "_blank");

    const nota = plantilla
      ? `WhatsApp enviado: ${plantilla.nombre}`
      : "WhatsApp abierto";

    setLoading("whatsapp");
    await registrar(nota, "whatsapp");
    setLoading(null);
    success("WhatsApp registrado");
  }

  async function handlePortal() {
    if (!portalUrl || (!telefono && !email)) return;
    setShowPlantillas(false);

    const mensaje = `Hola ${nombre}, aquí puedes entrar a tu portal${gymNombre ? ` de ${gymNombre}` : ""}: ${portalUrl}\n\nAhí ves tu membresía, tus check-ins y puedes renovar o reservar clases.`;

    if (telefono) {
      const numero = normalizarTelefonoMx(telefono);
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,
        "_blank"
      );
    } else if (email) {
      window.open(
        `mailto:${email}?subject=${encodeURIComponent("Tu acceso al portal")}&body=${encodeURIComponent(mensaje)}`,
        "_self"
      );
    }

    setLoading("portal");
    await registrar("Acceso al portal enviado", "whatsapp");
    setLoading(null);
    success("Acceso al portal enviado");
  }

  function handleEmail() {
    if (!email) return;
    window.open(`mailto:${email}`, "_self");
  }

  async function handleMarcarContactado() {
    setLoading("contactado");
    await registrar("Contacto marcado manualmente", "otro");
    setLoading(null);
    success("Contacto marcado");
  }

  const btnBase =
    "inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";
  const btnDefault =
    "text-text-secondary hover:bg-surface hover:text-text-primary";
  const btnActive = "bg-brand-green/10 text-brand-green";

  return (
    <div className="relative flex items-center gap-1">
      {/* Llamar */}
      <button
        type="button"
        onClick={handleLlamar}
        disabled={!telefono}
        title={telefono ? `Llamar a ${telefono}` : "Sin teléfono"}
        className={`${btnBase} ${btnDefault}`}
      >
        <LuPhone className="h-3.5 w-3.5" />
        Llamar
      </button>

      {/* WhatsApp (Pro) */}
      {canWhatsapp && (
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            plantillasFiltradas.length > 0
              ? setShowPlantillas((v) => !v)
              : handleWhatsApp()
          }
          disabled={!telefono || loading === "whatsapp"}
          title={telefono ? "WhatsApp" : "Sin teléfono"}
          className={`${btnBase} ${showPlantillas ? btnActive : btnDefault}`}
        >
          <LuMessageCircle className="h-3.5 w-3.5" />
          WhatsApp
          {plantillasFiltradas.length > 0 && (
            <LuChevronDown
              className={`h-3 w-3 transition-transform ${showPlantillas ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {showPlantillas && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPlantillas(false)}
            />
            <div className="absolute left-0 top-full z-20 mt-1 w-56 border border-border bg-surface">
              <div className="p-1">
                {plantillasFiltradas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleWhatsApp(p)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-surface-hover"
                  >
                    <span className="block font-medium text-text-primary">
                      {p.nombre}
                    </span>
                    <span className="mt-0.5 block truncate text-text-muted">
                      {p.contenido.slice(0, 60)}…
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleWhatsApp()}
                  className="w-full px-3 py-2 text-left text-xs text-text-muted hover:bg-surface-hover"
                >
                  Abrir sin plantilla
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Email */}
      <button
        type="button"
        onClick={handleEmail}
        disabled={!email}
        title={email ? `Enviar email a ${email}` : "Sin correo"}
        className={`${btnBase} ${btnDefault}`}
      >
        <LuMail className="h-3.5 w-3.5" />
        Email
      </button>

      {/* Portal — solo aplica a miembros (los prospectos no tienen cuenta) */}
      {entidadTipo === "miembro" && portalUrl && (
        <button
          type="button"
          onClick={handlePortal}
          disabled={(!telefono && !email) || loading === "portal"}
          title="Enviar acceso al portal"
          className={`${btnBase} ${btnDefault}`}
        >
          <LuLogIn className="h-3.5 w-3.5" />
          Portal
        </button>
      )}

      {/* Marcar contactado */}
      <button
        type="button"
        onClick={handleMarcarContactado}
        disabled={loading === "contactado"}
        title="Marcar como contactado"
        className={`${btnBase} ${btnDefault}`}
      >
        <LuCheck className="h-3.5 w-3.5" />
        Contactado
      </button>
    </div>
  );
}
