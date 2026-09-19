"use client";

import { useState, useTransition } from "react";
import { LuStar, LuX, LuExternalLink, LuThumbsUp } from "react-icons/lu";
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
    <section className="flex flex-col gap-4 border border-border bg-surface p-5">
      {!enviado ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-etiqueta uppercase text-text-secondary">
                Tu opinión
              </p>
              <h2 className="text-lg font-semibold text-text-primary">
                ¿Cómo estuvo tu visita?
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setCerrado(true)}
              aria-label="Cerrar"
              className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map((n) => {
              const activa = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <LuStar
                    className={`h-8 w-8 transition-colors ${
                      activa ? "fill-brand-green text-brand-green" : "text-text-muted"
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
            aria-label="Comentario"
            className="w-full resize-none rounded border border-border bg-bg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={enviar}
            className="inline-flex h-12 w-full items-center justify-center bg-brand-green px-4 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Enviar opinión"}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <LuThumbsUp className="h-8 w-8 text-brand-green" aria-hidden="true" />
          <p className="text-lg font-semibold text-text-primary">
            ¡Gracias por tu opinión!
          </p>
          {cinco && googlePlaceId && (
            <>
              <p className="text-sm text-text-secondary">
                ¿Nos ayudas compartiéndola en Google?
              </p>
              <a
                href={googleReviewUrl(googlePlaceId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 bg-brand-green px-5 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
              >
                Dejar reseña en Google{" "}
                <LuExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </>
          )}
        </div>
      )}
    </section>
  );
}
