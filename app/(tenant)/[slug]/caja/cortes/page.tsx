import Link from "next/link";
import { LuArrowLeft, LuClipboardList } from "react-icons/lu";
import { requirePanel } from "@/lib/authz/pagina";
import { listCortes } from "@/lib/queries/cortes.queries";
import { listCajasTodas } from "@/lib/queries/cajas.queries";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

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

const tabClass = (activa: boolean) =>
  cn(
    "inline-flex h-11 items-center border px-4 text-sm transition-colors",
    activa
      ? "border-brand-green bg-surface-hover text-brand-green"
      : "border-border bg-surface text-text-secondary hover:border-text-secondary hover:text-text-primary"
  );

export default async function CortesPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp, g] = await Promise.all([
    params,
    searchParams,
    // Misma política que abrirCorteAction: antes esta página no gateaba y un
    // entrenador con la URL veía el panel de cortes sin poder usarlo.
    requirePanel("caja.abrir_corte", { sinPermiso: "/checkins" }),
  ]);
  if (!g.ok) return null; // caja_basica es Starter: no ocurre
  const tenant = g.ctx;

  const [cortes, cajas] = await Promise.all([
    listCortes(tenant.id, { cajaId: sp.caja, limit: 50 }),
    listCajasTodas(tenant.id),
  ]);
  const nombreDeCaja = new Map(cajas.map((c) => [c.id, c.nombre]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}/caja`}
          className="inline-flex h-9 items-center gap-1.5 self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Caja
        </Link>
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          {cortes.length} {cortes.length === 1 ? "turno" : "turnos"}
        </p>
        <h2 className="text-pagina font-semibold text-text-primary">
          Cortes de caja
        </h2>
      </div>

      {cajas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/${slug}/caja/cortes`} className={tabClass(!sp.caja)}>
            Todas
          </Link>
          {cajas.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/caja/cortes?caja=${c.id}`}
              className={tabClass(sp.caja === c.id)}
            >
              {c.nombre}
            </Link>
          ))}
        </div>
      )}

      {cortes.length === 0 ? (
        <EmptyState ilustracion="reloj"
          icon={<LuClipboardList />}
          title="Sin cortes todavía"
          description="Cuando cierres tu primer turno de caja, el corte queda guardado aquí con sus totales por método de pago."
          action={
            <Link
              href={`/${slug}/caja`}
              className="inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
            >
              Ir a caja
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {cortes.map((c) => (
            <section key={c.id} className="card-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-mono text-dato tabular-nums text-text-primary">
                    {fechaHora(c.abierto_at)}
                    {c.cerrado_at && ` → ${fechaHora(c.cerrado_at)}`}
                    {cajas.length > 1 && (
                      <Badge variant="neutral">
                        {nombreDeCaja.get(c.caja_id) ?? "Caja eliminada"}
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    Abrió {c.abierto_por_nombre ?? "—"}
                    {c.cerrado_por_nombre && ` · Cerró ${c.cerrado_por_nombre}`}
                  </p>
                </div>
                {c.estado === "abierto" ? (
                  <Badge variant="success">Abierto</Badge>
                ) : (
                  <DiferenciaBadge diferencia={c.diferencia} />
                )}
              </div>

              {c.estado === "cerrado" && (
                <div className="flex flex-col gap-4 px-5 py-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Dato label="Fondo" valor={c.fondo_inicial} />
                    <Dato label="Efectivo" valor={c.total_efectivo} />
                    <Dato label="Tarjeta" valor={c.total_tarjeta} />
                    <Dato label="Transferencia" valor={c.total_transferencia} />
                    <Dato label="Esperado" valor={c.efectivo_esperado} />
                    <Dato label="Contado" valor={c.efectivo_contado} />
                  </dl>

                  {(c.total_membresia || c.total_visita || c.total_producto || c.total_otro) != null &&
                    (Number(c.total_membresia) > 0 ||
                      Number(c.total_visita) > 0 ||
                      Number(c.total_producto) > 0 ||
                      Number(c.total_otro) > 0) && (
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3">
                        <Dato label="Membresías" valor={c.total_membresia} />
                        <Dato label="Visitas" valor={c.total_visita} />
                        <Dato label="Productos" valor={c.total_producto} />
                        <Dato label="Otros" valor={c.total_otro} />
                        {c.ganancia_productos !== null &&
                          Number(c.total_producto) > 0 && (
                            <Dato
                              label="Ganancia productos"
                              valor={c.ganancia_productos}
                              acento
                            />
                          )}
                      </dl>
                    )}
                </div>
              )}

              {c.notas && (
                <p className="border-t border-border px-5 py-4 text-sm text-text-secondary">
                  “{c.notas}”
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({
  label,
  valor,
  acento = false,
}: {
  label: string;
  valor: number | null;
  acento?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-etiqueta uppercase text-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 font-mono text-dato tabular-nums",
          acento ? "text-success" : "text-text-primary"
        )}
      >
        {valor === null ? "—" : formatMoneda(valor)}
      </dd>
    </div>
  );
}

function DiferenciaBadge({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null) return null;
  const cuadra = diferencia === 0;
  const faltante = diferencia < 0;
  const label = cuadra
    ? "Cuadra"
    : `${faltante ? "Faltante" : "Sobrante"} ${formatMoneda(Math.abs(diferencia))}`;
  return (
    <Badge variant={cuadra ? "success" : faltante ? "danger" : "warning"}>
      {label}
    </Badge>
  );
}
