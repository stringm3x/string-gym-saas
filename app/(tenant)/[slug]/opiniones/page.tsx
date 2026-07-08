import { LuStar, LuTrendingUp, LuTrendingDown, LuMinus } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { getOpinionesResumen } from "@/lib/queries/opiniones.queries";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function Estrellas({ n, size = "h-4 w-4" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <LuStar
          key={i}
          className={`${size} ${
            i <= Math.round(n) ? "fill-warning text-warning" : "text-text-muted"
          }`}
        />
      ))}
    </span>
  );
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function OpinionesPage({ params }: PageProps) {
  await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "opiniones")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Opiniones de tus miembros"
        descripcion="Recibe calificaciones y comentarios de tus miembros desde el portal, y da seguimiento a tu reputación."
        beneficios={[
          "Calificación promedio del mes y su tendencia",
          "Distribución de estrellas (1 a 5)",
          "Últimos comentarios de tus miembros",
          "Impulso de reseñas en Google para 5★",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const r = await getOpinionesResumen(tenant.id);
  const delta = r.promedioMes - r.promedioMesAnterior;
  const maxDist = Math.max(...r.distribucion, 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Opiniones
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Lo que opinan tus miembros de su experiencia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Promedio del mes */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Promedio del mes
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-mono text-4xl font-bold tabular-nums text-text-primary">
              {r.promedioMes.toFixed(1)}
            </span>
            <LuStar className="mb-1.5 h-7 w-7 fill-warning text-warning" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {r.promedioMesAnterior === 0 ? (
              <span className="text-text-muted">Sin datos del mes anterior</span>
            ) : Math.abs(delta) < 0.05 ? (
              <span className="flex items-center gap-1 text-text-muted">
                <LuMinus className="h-3.5 w-3.5" /> Igual que el mes anterior
              </span>
            ) : delta > 0 ? (
              <span className="flex items-center gap-1 text-brand-green">
                <LuTrendingUp className="h-3.5 w-3.5" /> +{delta.toFixed(1)} vs
                mes anterior
              </span>
            ) : (
              <span className="flex items-center gap-1 text-danger">
                <LuTrendingDown className="h-3.5 w-3.5" /> {delta.toFixed(1)} vs
                mes anterior
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {r.totalMes} opinión{r.totalMes === 1 ? "" : "es"} este mes
          </p>
        </div>

        {/* Distribución */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Distribución (mes)
          </p>
          <ul className="mt-3 space-y-1.5">
            {[5, 4, 3, 2, 1].map((estrella) => {
              const c = r.distribucion[estrella - 1];
              return (
                <li key={estrella} className="flex items-center gap-2">
                  <span className="flex w-8 items-center gap-0.5 text-xs text-text-secondary">
                    {estrella}
                    <LuStar className="h-3 w-3 fill-warning text-warning" />
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${(c / maxDist) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-xs tabular-nums text-text-secondary">
                    {c}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Últimas opiniones */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Últimas opiniones
        </h3>
        {r.ultimas.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-secondary">
            Aún no tienes opiniones.
          </p>
        ) : (
          <ul className="space-y-2">
            {r.ultimas.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Estrellas n={o.calificacion} />
                  <span className="text-xs text-text-muted">
                    {o.miembro_nombre ? `${o.miembro_nombre} · ` : ""}
                    {fecha(o.created_at)}
                  </span>
                </div>
                {o.comentario && (
                  <p className="mt-2 text-sm text-text-secondary">
                    {o.comentario}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
