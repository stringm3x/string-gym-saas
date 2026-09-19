import type { ReactNode } from "react";

/**
 * Marco de escaneo del kiosco (artboard "Kiosco — autoservicio"): cuatro
 * esquinas gruesas en el color del gimnasio alrededor del lector. Se ve a
 * distancia y le dice al socio dónde acercar el QR.
 */
export function KioscoMarco({ children }: { children: ReactNode }) {
  const esquina = "absolute h-[72px] w-[72px] border-brand-green";
  return (
    <div className="relative h-[280px] w-[280px] shrink-0 sm:h-[320px] sm:w-[320px]">
      <span aria-hidden="true" className={`${esquina} left-0 top-0 border-l-8 border-t-8`} />
      <span aria-hidden="true" className={`${esquina} right-0 top-0 border-r-8 border-t-8`} />
      <span aria-hidden="true" className={`${esquina} bottom-0 left-0 border-b-8 border-l-8`} />
      <span aria-hidden="true" className={`${esquina} bottom-0 right-0 border-b-8 border-r-8`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
        {children}
      </div>
    </div>
  );
}

/** Pictograma QR de trazo, para el centro del marco cuando no hay cámara. */
export function QrPictograma({ className = "h-28 w-28" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3" />
      <path d="M14 20h3" />
      <path d="M20 20v1" />
    </svg>
  );
}
