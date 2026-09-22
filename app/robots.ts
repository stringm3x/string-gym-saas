import type { MetadataRoute } from "next";

/**
 * Bloque 10 sueltos (privacidad): NO se pone Disallow sobre /recibos, /qr,
 * /portal ni /kiosco — si un crawler tiene prohibido entrar, nunca lee el
 * `noindex` de esas páginas (metadata) ni el header X-Robots-Tag que manda
 * proxy.ts, y la URL puede quedar indexada igual si aparece enlazada desde
 * otro lado. Esas cuatro se dejan entrar a propósito para que el noindex
 * funcione; lo único que las protege es eso, no este archivo.
 *
 * El panel del tenant (`/[slug]/*`, sin prefijo fijo porque el slug es de
 * cada gym) y `/admin/*` sí se bloquean aquí: exigen sesión de todos modos
 * y no tienen contenido útil que un crawler pueda leer sin ella.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/login",
        "/recuperar-password",
        "/auth/",
        "/recibos/",
        "/qr/",
        "/kiosco/",
        "/portal/",
        "/sdk-docs",
        "/api-docs",
      ],
      disallow: "/",
    },
  };
}
