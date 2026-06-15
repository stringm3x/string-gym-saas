import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind, resolviendo conflictos
 * (ej. "p-2" vs "p-4" — gana la última) y permitiendo
 * condicionales: cn('base', condicion && 'extra')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
