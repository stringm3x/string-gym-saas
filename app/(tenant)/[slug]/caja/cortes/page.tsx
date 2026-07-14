import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listCortes } from "@/lib/queries/cortes.queries";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

export default async function CortesPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();
  const cortes = await listCortes(tenant.id, 50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/${slug}/caja`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-brand-green"
        >
          <LuArrowLeft className="h-3.5 w-3.5" /> Volver a Caja
        </Link>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-text-primary">
          Cortes de caja
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Historial de turnos: totales por método y cuadre de efectivo.
        </p>
      </div>

      {cortes.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
          Aún no hay cortes registrados.
        </p>
      ) : (
        <div className="space-y-3">
          {cortes.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {fechaHora(c.abierto_at)}
                    {c.cerrado_at && ` → ${fechaHora(c.cerrado_at)}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    Abrió {c.abierto_por_nombre ?? "—"}
                    {c.cerrado_por_nombre &&
                      ` · Cerró ${c.cerrado_por_nombre}`}
                  </p>
                </div>
                {c.estado === "abierto" ? (
                  <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                    Abierto
                  </span>
                ) : (
                  <DiferenciaBadge diferencia={c.diferencia} />
                )}
              </div>

              {c.estado === "cerrado" && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                  <Dato label="Fondo" valor={c.fondo_inicial} />
                  <Dato label="Efectivo" valor={c.total_efectivo} />
                  <Dato label="Tarjeta" valor={c.total_tarjeta} />
                  <Dato label="Transferencia" valor={c.total_transferencia} />
                  <Dato label="Esperado" valor={c.efectivo_esperado} />
                  <Dato label="Contado" valor={c.efectivo_contado} />
                </div>
              )}

              {c.notas && (
                <p className="mt-2 text-xs italic text-text-secondary">
                  “{c.notas}”
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: number | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono tabular-nums text-text-primary">
        {valor === null ? "—" : formatMoneda(valor)}
      </span>
    </div>
  );
}

function DiferenciaBadge({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null) return null;
  const cuadra = diferencia === 0;
  const faltante = diferencia < 0;
  const cls = cuadra
    ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
    : faltante
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-warning/30 bg-warning/10 text-warning";
  const label = cuadra
    ? "Cuadra"
    : `${faltante ? "Faltante" : "Sobrante"} ${formatMoneda(Math.abs(diferencia))}`;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
