"use client";

import Image from "next/image";
import { LuSunrise, LuLayoutDashboard, LuUsers } from "react-icons/lu";

interface MarcaPreviewProps {
  logoUrl: string | null;
  colorAcento: string;
  colorSidebar: string;
  colorFondo: string;
  gymNombre: string;
}

export function MarcaPreview({
  logoUrl,
  colorAcento,
  colorSidebar,
  colorFondo,
  gymNombre,
}: MarcaPreviewProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Vista previa
      </p>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex h-64">
          {/* Sidebar simulado */}
          <div
            className="flex w-32 shrink-0 flex-col gap-3 p-3"
            style={{ backgroundColor: colorSidebar }}
          >
            <div className="flex h-8 items-center">
              {logoUrl ? (
                <div className="relative h-7 w-full">
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
                <span className="truncate text-xs font-bold uppercase tracking-wide text-white">
                  {gymNombre || "Mi Gym"}
                </span>
              )}
            </div>

            {/* Item "Hoy" activo con color acento */}
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: hexToRgba(colorAcento, 0.15) }}
            >
              <LuSunrise className="h-3.5 w-3.5" style={{ color: colorAcento }} />
              <span
                className="text-[11px] font-medium"
                style={{ color: colorAcento }}
              >
                Hoy
              </span>
            </div>

            <div className="flex items-center gap-2 px-2 py-1.5">
              <LuLayoutDashboard className="h-3.5 w-3.5 text-white/50" />
              <span className="text-[11px] text-white/50">Dashboard</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <LuUsers className="h-3.5 w-3.5 text-white/50" />
              <span className="text-[11px] text-white/50">Miembros</span>
            </div>
          </div>

          {/* Contenido simulado */}
          <div
            className="flex flex-1 flex-col gap-4 p-4"
            style={{ backgroundColor: colorFondo }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: hexToRgba(colorAcento, 0.15),
                  color: colorAcento,
                }}
              >
                Activo
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary">
                Por vencer
              </span>
            </div>

            <button
              type="button"
              disabled
              className="w-fit rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ backgroundColor: colorAcento, color: "#0a0a0a" }}
            >
              Botón primario
            </button>

            <div className="mt-auto h-1.5 w-2/3 rounded-full"
              style={{ backgroundColor: colorAcento }}
            />
          </div>
        </div>
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
