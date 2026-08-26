import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { listCortes } from "@/lib/queries/cortes.queries";
import { listCajasTodas } from "@/lib/queries/cajas.queries";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ caja?: string }>;
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

export default async function CortesPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp, tenant] = await Promise.all([
    params,
    searchParams,
    getTenant(),
  ]);

  const [cortes, cajas] = await Promise.all([
    listCortes(tenant.id, { cajaId: sp.caja, limit: 50 }),
    listCajasTodas(tenant.id),
  ]);
  const nombreDeCaja = new Map(cajas.map((c) => [c.id, c.nombre]));

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

      {cajas.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <Link
            href={`/${slug}/caja/cortes`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              !sp.caja
                ? "bg-bg text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            Todas
          </Link>
          {cajas.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/caja/cortes?caja=${c.id}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                sp.caja === c.id
                  ? "bg-bg text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {c.nombre}
            </Link>
          ))}
        </div>
      )}

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
                  <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    {fechaHora(c.abierto_at)}
                    {c.cerrado_at && ` → ${fechaHora(c.cerrado_at)}`}
                    {cajas.length > 1 && (
                      <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        {nombreDeCaja.get(c.caja_id) ?? "Caja eliminada"}
                      </span>
                    )}
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
                <>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    <Dato label="Fondo" valor={c.fondo_inicial} />
                    <Dato label="Efectivo" valor={c.total_efectivo} />
                    <Dato label="Tarjeta" valor={c.total_tarjeta} />
                    <Dato label="Transferencia" valor={c.total_transferencia} />
                    <Dato label="Esperado" valor={c.efectivo_esperado} />
                    <Dato label="Contado" valor={c.efectivo_contado} />
                  </div>

                  {(c.total_membresia || c.total_visita || c.total_producto || c.total_otro) != null &&
                    (Number(c.total_membresia) > 0 ||
                      Number(c.total_visita) > 0 ||
                      Number(c.total_producto) > 0 ||
                      Number(c.total_otro) > 0) && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2 text-xs sm:grid-cols-3">
                        <Dato label="Membresías" valor={c.total_membresia} />
                        <Dato label="Visitas" valor={c.total_visita} />
                        <Dato label="Productos" valor={c.total_producto} />
                        <Dato label="Otros" valor={c.total_otro} />
                        {c.ganancia_productos !== null &&
                          Number(c.total_producto) > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-text-muted">
                                Ganancia productos
                              </span>
                              <span className="font-mono tabular-nums text-success">
                                {formatMoneda(c.ganancia_productos)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                </>
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
    ? "border-success/30 bg-success/10 text-success"
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
