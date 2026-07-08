"use client";

import { useState, useTransition } from "react";
import { LuStar, LuX, LuExternalLink } from "react-icons/lu";
import { enviarOpinionPortalAction } from "@/app/portal/[slug]/opinion-actions";

/** URL de reseña de Google a partir del Place ID. */
function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

export function OpinionForm({
  slug,
  googlePlaceId,
}: {
  slug: string;
  googlePlaceId?: string | null;
}) {
  const [cerrado, setCerrado] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cinco, setCinco] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (cerrado) return null;

  function enviar() {
    if (rating < 1) {
      setError("Selecciona de 1 a 5 estrellas.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await enviarOpinionPortalAction(slug, rating, comentario);
      if (!r.ok) {
        setError(r.error ?? "No se pudo enviar.");
        return;
      }
      setCinco(!!r.cincoEstrellas);
      setEnviado(true);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      {!enviado ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              ¿Cómo estuvo tu visita?
            </h2>
            <button
              type="button"
              onClick={() => setCerrado(true)}
              aria-label="Cerrar"
              className="text-text-muted transition-colors hover:text-text-primary"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const activa = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
                  className="p-0.5"
                >
                  <LuStar
                    className={`h-8 w-8 transition-colors ${
                      activa
                        ? "fill-warning text-warning"
                        : "text-text-muted"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Cuéntanos más (opcional)"
            className="mt-3 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          />

          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          <button
            type="button"
            disabled={pending}
            onClick={enviar}
            className="mt-3 w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Enviar opinión"}
          </button>
        </>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">
            ¡Gracias por tu opinión! 🙌
          </p>
          {cinco && googlePlaceId && (
            <>
              <p className="mt-1 text-xs text-text-secondary">
                ¿Nos ayudas compartiendo tu experiencia?
              </p>
              <a
                href={googleReviewUrl(googlePlaceId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                Dejar reseña en Google <LuExternalLink className="h-4 w-4" />
              </a>
            </>
          )}
        </div>
      )}
    </section>
  );
}
