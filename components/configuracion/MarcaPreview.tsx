"use client";

import Image from "next/image";
import { LuCalendarCheck } from "react-icons/lu";

interface MarcaPreviewProps {
  logoUrl: string | null;
  colorAcento: string;
  gymNombre: string;
}

/**
 * Vista previa de cómo ve el socio el color del gym — portal, kiosco y
 * recibo, no el panel del staff (que ya no se personaliza, plan/02-gating).
 */
export function MarcaPreview({ logoUrl, colorAcento, gymNombre }: MarcaPreviewProps) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        Vista previa · portal del socio
      </p>

      <div className="flex flex-col gap-5 border border-border bg-bg p-6">
        <div className="flex h-8 items-center">
          {logoUrl ? (
            <div className="relative h-7 w-28">
              <Image
                src={logoUrl}
                alt={gymNombre}
                fill
                sizes="120px"
                className="object-contain object-left"
                unoptimized
              />
            </div>
          ) : (
            <span className="truncate font-mono text-etiqueta uppercase text-text-primary">
              {gymNombre || "Mi gimnasio"}
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-2 border p-4"
          style={{
            backgroundColor: hexToRgba(colorAcento, 0.1),
            borderColor: hexToRgba(colorAcento, 0.4),
          }}
        >
          <LuCalendarCheck className="h-5 w-5 shrink-0" style={{ color: colorAcento }} />
          <p className="text-sm text-text-primary">
            Tu membresía vence el <strong>28 de este mes</strong>.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="h-11 w-fit px-5 text-sm font-semibold"
          style={{ backgroundColor: colorAcento, color: "var(--color-on-brand)" }}
        >
          Renovar membresía
        </button>
      </div>
    </div>
  );
}

/** Convierte #RRGGBB + alpha a rgba(). Si el hex es inválido, usa el color tal cual. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
