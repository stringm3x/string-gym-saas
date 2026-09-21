import { cn } from "@/lib/utils/cn";
import { ILUSTRACIONES, type IlustracionNombre } from "@/components/arte/Ilustraciones";

interface EmptyStateProps {
  /** Ícono de trazo (react-icons/lu). Se pinta en ácido a 48px. */
  icon?: React.ReactNode;
  /** Ilustración de marca (bloque ácido con dibujo). Gana sobre `icon`. */
  ilustracion?: IlustracionNombre;
  /** Título corto. Va en Anton, en mayúsculas: aquí sí entra el cartel. */
  title: string;
  description?: string;
  /** Uno o dos botones (primario + secundario). */
  action?: React.ReactNode;
  /** Pie en mono, p. ej. "TOMA 2 MINUTOS". Solo si aporta algo. */
  hint?: string;
  className?: string;
}

/**
 * Estado vacío del sistema. Es una de las superficies donde el gimnasio no
 * está trabajando, está conociendo el producto: por eso lleva Anton, aire y,
 * cuando el vacío es toda el área, una ilustración de la marca.
 * Un solo titular Anton por pantalla.
 */
export function EmptyState({
  icon,
  ilustracion,
  title,
  description,
  action,
  hint,
  className,
}: EmptyStateProps) {
  const Ilustracion = ilustracion ? ILUSTRACIONES[ilustracion] : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 px-6 py-16 text-center",
        className
      )}
    >
      {Ilustracion ? (
        <div className="relative h-32 w-52 overflow-hidden shadow-hard-ink">
          <Ilustracion className="h-full w-full" />
        </div>
      ) : (
        icon && (
          <span
            aria-hidden="true"
            className="text-brand-green [&>svg]:h-12 [&>svg]:w-12 [&>svg]:stroke-[1.75]"
          >
            {icon}
          </span>
        )
      )}

      <div className="flex flex-col items-center gap-3">
        <h3 className="font-display text-titular-m uppercase text-text-primary">
          {title}
        </h3>
        {description && (
          <p className="max-w-md text-cuerpo-s text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      )}

      {hint && (
        <p className="font-mono text-etiqueta uppercase text-text-muted">{hint}</p>
      )}
    </div>
  );
}
