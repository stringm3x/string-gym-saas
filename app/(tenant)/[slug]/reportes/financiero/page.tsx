import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getReporteFinanciero } from "@/lib/queries/negocio.queries";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { formatMoneda, formatFecha } from "@/lib/utils/format";
import { hoyISO } from "@/lib/utils/dates";
import { ReporteControls } from "@/components/reportes/ReporteControls";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReporteFinancieroPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "ver_dashboard_ingresos")) {
    redirect(`/${slug}/dashboard`);
  }

  const sp = await searchParams;
  const hoy = hoyISO();
  const desde = sp.desde && RE_FECHA.test(sp.desde) ? sp.desde : hoy.slice(0, 8) + "01";
  const hasta = sp.hasta && RE_FECHA.test(sp.hasta) ? sp.hasta : hoy;

  const [r, gym] = await Promise.all([
    getReporteFinanciero(tenant.id, desde, hasta),
    getGymInfo(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Reporte financiero
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {gym?.nombre} · {formatFecha(desde)} — {formatFecha(hasta)}
        </p>
      </div>

      <ReporteControls slug={slug} desde={desde} hasta={hasta} />

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <Seccion titulo="Ingresos por método">
          <Fila label="Efectivo" valor={r.ingresosPorMetodo.efectivo} />
          <Fila label="Tarjeta" valor={r.ingresosPorMetodo.tarjeta} />
          <Fila label="Transferencia" valor={r.ingresosPorMetodo.transferencia} />
          <Fila label="Total" valor={r.ingresosPorMetodo.total} fuerte />
        </Seccion>

        <Seccion titulo="Ingresos por concepto">
          <Fila label="Membresías" valor={r.ingresosPorConcepto.membresia} />
          <Fila label="Productos" valor={r.ingresosPorConcepto.producto} />
          <Fila label="Visitas" valor={r.ingresosPorConcepto.visita} />
          <Fila label="Otros" valor={r.ingresosPorConcepto.otro} />
        </Seccion>

        <Seccion titulo="Reembolsos y notas de crédito">
          <Fila label="Reembolsos en efectivo" valor={-r.reembolsosEfectivo} />
          <Fila
            label="Reembolsos tarjeta/transferencia"
            valor={-r.reembolsosOtros}
          />
          <Fila label="Notas de crédito emitidas" valor={r.notasCredito} />
        </Seccion>

        <Seccion titulo="Cortes de caja">
          <Fila label="Cortes cerrados" texto={String(r.cortes.cantidad)} />
          <Fila label="Diferencia acumulada" valor={r.cortes.diferencia} />
        </Seccion>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Ingreso neto
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums text-brand-green">
            {formatMoneda(r.ingresoNeto)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {titulo}
      </h3>
      <div className="divide-y divide-border rounded-lg border border-border">
        {children}
      </div>
    </div>
  );
}

function Fila({
  label,
  valor,
  texto,
  fuerte = false,
}: {
  label: string;
  valor?: number;
  texto?: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          fuerte ? "font-semibold text-text-primary" : "text-text-primary"
        }`}
      >
        {texto ?? (valor !== undefined ? formatMoneda(valor) : "—")}
      </span>
    </div>
  );
}
