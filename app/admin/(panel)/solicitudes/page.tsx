import { LuClock } from "react-icons/lu";

/**
 * Placeholder de "Solicitudes" — preparado para Fase 7.2 (Pre-registro).
 * La estructura ya existe (ruta + nav + gate); Fase 7.2 solo agregará las
 * queries y la tabla de solicitudes, sin tocar el layout del admin.
 */
export default function SolicitudesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Solicitudes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Gestión de solicitudes de prueba.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <LuClock className="h-9 w-9 text-text-muted" />
        <h2 className="mt-3 text-sm font-semibold text-text-primary">
          Próximamente
        </h2>
        <p className="mt-1 max-w-sm text-xs text-text-secondary">
          Aquí gestionarás las solicitudes de prueba que lleguen desde el
          pre-registro (Fase 7.2): activarlas, asignar plan y convertirlas en
          tenants.
        </p>
      </div>
    </div>
  );
}
