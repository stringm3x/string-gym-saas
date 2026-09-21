import { FaWhatsapp } from "react-icons/fa";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

/**
 * Banner de días restantes de prueba (Bloque 10 PR2): visible desde el día
 * 10 de 14 (4 días o menos). Solo para el owner — es quien puede activar un
 * plan pagado, igual que el gate de Términos (ver TenantLayout).
 */
export function TrialBanner({
  nombre,
  diasRestantes,
}: {
  nombre: string;
  diasRestantes: number;
}) {
  const texto =
    diasRestantes <= 0
      ? "Tu prueba vence hoy."
      : `Tu prueba vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}.`;
  const wa = `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Hola Carlos, soy de ${nombre} y quiero activar mi plan pagado antes de que termine la prueba.`
  )}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2.5 sm:px-8">
      <p className="text-sm text-text-primary">
        {texto} Actívalo con un plan pagado para no perder acceso.
      </p>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center gap-2 bg-brand-green px-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
      >
        <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
        Contactar por WhatsApp
      </a>
    </div>
  );
}
