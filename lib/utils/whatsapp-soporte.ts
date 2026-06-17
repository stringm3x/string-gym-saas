import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

function buildUrl(mensaje: string): string {
  return `https://wa.me/${STRING_SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    mensaje
  )}`;
}

export function whatsappContratarAddon(
  gymNombre: string,
  addonNombre: string,
  precio: number
): string {
  return buildUrl(
    `Hola, soy del gym ${gymNombre} y quiero contratar el add-on "${addonNombre}" ($${precio}/mes). ¿Cómo procedemos?`
  );
}

export function whatsappNotificarAddon(
  gymNombre: string,
  addonNombre: string
): string {
  return buildUrl(
    `Hola, soy del gym ${gymNombre}. Por favor avísame cuando esté disponible el add-on "${addonNombre}".`
  );
}

export function whatsappCancelarAddon(
  gymNombre: string,
  addonNombre: string
): string {
  return buildUrl(
    `Hola, soy del gym ${gymNombre} y quiero cancelar el add-on "${addonNombre}".`
  );
}
