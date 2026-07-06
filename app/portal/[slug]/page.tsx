import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LuCalendarPlus,
  LuRefreshCw,
  LuCalendarDays,
  LuScanLine,
  LuReceipt,
} from "react-icons/lu";
import { requirePortal } from "@/lib/portal/session";
import {
  getMiembroPortal,
  getProximasReservasPortal,
  getCheckinsPortal,
} from "@/lib/queries/portal.queries";
import { hasFeature } from "@/lib/features";
import { PortalHeader } from "@/components/portal/PortalHeader";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function fechaLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default async function PortalHomePage({ params }: PageProps) {
  const { slug } = await params;
  const { gym, session } = await requirePortal(slug);

  const miembro = await getMiembroPortal(session.tenantId, session.miembroId);
  if (!miembro) redirect(`/portal/${slug}/login`);

  const canClases = hasFeature(gym.plan, "clases");
  const [reservas, checkins] = await Promise.all([
    canClases
      ? getProximasReservasPortal(session.tenantId, session.miembroId)
      : Promise.resolve([]),
    getCheckinsPortal(session.tenantId, session.miembroId, 30),
  ]);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = miembro.fecha_vencimiento
    ? new Date(miembro.fecha_vencimiento + "T00:00:00")
    : null;
  const diasRestantes = venc
    ? Math.round((venc.getTime() - hoy.getTime()) / 86400000)
    : null;
  const vigente = diasRestantes !== null && diasRestantes >= 0;

  return (
    <div className="min-h-screen">
      <PortalHeader slug={slug} gymNombre={gym.nombre} />

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {/* Estado de membresía */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-text-secondary">Hola,</p>
          <h1 className="text-xl font-semibold text-text-primary">
            {miembro.nombre}
          </h1>

          <div className="mt-4 flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                vigente
                  ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
                  : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {vigente ? "Membresía activa" : "Membresía vencida"}
            </span>
          </div>

          {venc && (
            <p className="mt-2 text-sm text-text-secondary">
              Vence el{" "}
              <span className="text-text-primary">
                {venc.toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {diasRestantes !== null &&
                (diasRestantes >= 0
                  ? ` · ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} restante${diasRestantes === 1 ? "" : "s"}`
                  : ` · venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? "" : "s"}`)}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href={`/portal/${slug}/renovar`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-green px-3 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
            >
              <LuRefreshCw className="h-4 w-4" /> Renovar
            </Link>
            {canClases && (
              <Link
                href={`/portal/${slug}/clases`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-brand-green"
              >
                <LuCalendarPlus className="h-4 w-4" /> Reservar clase
              </Link>
            )}
          </div>

          <Link
            href={`/portal/${slug}/recibos`}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <LuReceipt className="h-3.5 w-3.5" /> Mis recibos
          </Link>
        </section>

        {/* Próximas clases */}
        {canClases && (
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <LuCalendarDays className="h-4 w-4 text-brand-green" /> Próximas
              clases
            </h2>
            {reservas.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">
                No tienes clases reservadas.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {reservas.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {r.clase_nombre}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {fechaLarga(r.fecha)} · {r.hora_inicio.slice(0, 5)}
                      </p>
                    </div>
                    {r.estado === "en_lista_espera" && (
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        Lista de espera
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Check-ins */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <LuScanLine className="h-4 w-4 text-brand-green" /> Tus visitas (30
            días)
          </h2>
          {checkins.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">
              Sin visitas registradas en los últimos 30 días.
            </p>
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold text-text-primary">
                {checkins.length}
                <span className="ml-1 text-sm font-normal text-text-secondary">
                  visita{checkins.length === 1 ? "" : "s"}
                </span>
              </p>
              <ul className="mt-2 space-y-1">
                {checkins.slice(0, 5).map((c) => (
                  <li key={c.id} className="text-xs text-text-secondary">
                    {new Date(c.fecha_hora).toLocaleDateString("es-MX", {
                      weekday: "long",
                      day: "2-digit",
                      month: "short",
                    })}
                    {" · "}
                    {new Date(c.fecha_hora).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
