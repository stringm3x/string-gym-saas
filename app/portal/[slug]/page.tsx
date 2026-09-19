import { redirect } from "next/navigation";
import Link from "next/link";
import { LuScanLine, LuRefreshCw, LuCalendarPlus } from "react-icons/lu";
import { requirePortal } from "@/lib/portal/session";
import {
  getMiembroPortal,
  getProximasReservasPortal,
  getCheckinsPortal,
  getQrTokenPortal,
} from "@/lib/queries/portal.queries";
import { generarQRDataUrl } from "@/lib/utils/qr-generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { tieneSolicitudCongelacion } from "@/lib/queries/miembro-eventos.queries";
import { PortalCongelar } from "@/components/portal/PortalCongelar";
import { hasFeature } from "@/lib/features";
import { yaOpinoEsteMes, getGooglePlaceId } from "@/lib/queries/opiniones.queries";
import { getPlanNutricionActivoPortal } from "@/lib/queries/nutricion.queries";
import { hoyISO, TZ_MX } from "@/lib/utils/dates";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { OpinionForm } from "@/components/portal/OpinionForm";
import { PlanNutricionCard } from "@/components/nutricion/PlanNutricionCard";
import { Badge } from "@/components/ui/Badge";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function fechaCorta(iso: string): string {
  return new Date(iso + "T00:00:00")
    .toLocaleDateString("es-MX", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .replace(/\./g, "");
}

function fechaLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** YYYY-MM-DD de un instante en hora de México. */
function ymdMX(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ_MX });
}

const INICIALES_DIA = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Inicio del portal del socio (artboard "Portal del socio — móvil"). Manda
 * el color del gimnasio (el layout lo inyecta). Se ve en el celular, muchas
 * veces con mala luz: contraste alto, botones de 48px.
 */
export default async function PortalHomePage({ params }: PageProps) {
  const { slug } = await params;
  const { gym, session } = await requirePortal(slug);

  const miembro = await getMiembroPortal(session.tenantId, session.miembroId);
  if (!miembro) redirect(`/portal/${slug}/login`);

  const canClases = hasFeature(gym.plan, "clases");
  const canOpiniones = hasFeature(gym.plan, "opiniones");
  const canNutricion = hasFeature(gym.plan, "nutricion");
  const canQr = hasFeature(gym.plan, "qr_access");
  const [reservas, checkins, opinoEsteMes, googlePlaceId, planNutricion, qrToken] =
    await Promise.all([
      canClases
        ? getProximasReservasPortal(session.tenantId, session.miembroId)
        : Promise.resolve([]),
      getCheckinsPortal(session.tenantId, session.miembroId, 30),
      canOpiniones
        ? yaOpinoEsteMes(session.tenantId, session.miembroId)
        : Promise.resolve(true),
      canOpiniones ? getGooglePlaceId(session.tenantId) : Promise.resolve(null),
      canNutricion
        ? getPlanNutricionActivoPortal(session.tenantId, session.miembroId)
        : Promise.resolve(null),
      canQr
        ? getQrTokenPortal(session.tenantId, session.miembroId)
        : Promise.resolve(null),
    ]);

  const qrDataUrl = qrToken ? await generarQRDataUrl(qrToken) : null;

  const hoy = new Date(hoyISO() + "T00:00:00");
  const venc = miembro.fecha_vencimiento
    ? new Date(miembro.fecha_vencimiento + "T00:00:00")
    : null;
  const diasRestantes = venc
    ? Math.round((venc.getTime() - hoy.getTime()) / 86400000)
    : null;
  // Plan por visitas (D8): la vigencia la manda el saldo de visitas.
  const porVisitas = miembro.visitas_restantes != null;
  const vigente = porVisitas
    ? (miembro.visitas_restantes as number) > 0
    : diasRestantes !== null && diasRestantes >= 0;

  // Congelación (D7): solo aplica a planes por tiempo.
  const congelacionPendiente =
    !porVisitas &&
    (await tieneSolicitudCongelacion(
      session.tenantId,
      session.miembroId,
      createAdminClient()
    ));

  // Cifra grande de la tarjeta de membresía.
  const cifra = porVisitas
    ? String(miembro.visitas_restantes)
    : diasRestantes === null
      ? "—"
      : String(Math.abs(diasRestantes));
  const cifraLabel = porVisitas
    ? (miembro.visitas_restantes as number) === 1
      ? "visita disponible"
      : "visitas disponibles"
    : diasRestantes === null
      ? "sin fecha de vencimiento"
      : diasRestantes >= 0
        ? diasRestantes === 1
          ? "día restante"
          : "días restantes"
        : Math.abs(diasRestantes) === 1
          ? "día de vencida"
          : "días de vencida";

  // Últimos 7 días: qué días vino.
  const visitados = new Set(checkins.map((c) => ymdMX(new Date(c.fecha_hora))));
  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { ymd: ymdMX(d), dia: INICIALES_DIA[d.getDay()] };
  });

  const proximaClase = reservas[0];

  const primaryClass =
    "inline-flex h-12 items-center justify-center gap-2 bg-brand-green px-4 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90";
  const secondaryClass =
    "inline-flex h-12 items-center justify-center gap-2 border border-border px-4 text-base text-text-primary transition-colors hover:border-text-secondary";

  return (
    <div className="min-h-screen">
      <PortalHeader slug={slug} gymNombre={gym.nombre} />

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {/* Membresía */}
        <section className="flex flex-col gap-5 border border-border bg-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-etiqueta uppercase text-text-secondary">
                Tu membresía
              </p>
              <p className="text-base text-text-primary">Hola, {miembro.nombre}</p>
            </div>
            <Badge variant={vigente ? "success" : "danger"}>
              {vigente ? "Membresía activa" : "Membresía vencida"}
            </Badge>
          </div>

          <div className="flex items-end gap-3">
            <span
              className={`font-display text-[88px] leading-[76px] ${
                vigente ? "text-text-primary" : "text-danger"
              }`}
            >
              {cifra}
            </span>
            <span className="pb-1 text-base text-text-secondary">{cifraLabel}</span>
          </div>

          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {miembro.fecha_vencimiento && !porVisitas
              ? `Vence ${fechaLarga(miembro.fecha_vencimiento)}`
              : porVisitas
                ? "Plan por visitas"
                : "Sin vencimiento registrado"}
          </p>

          {qrDataUrl && qrToken && (
            <a href={`/qr/${qrToken}`} className={primaryClass}>
              <LuScanLine className="h-5 w-5" aria-hidden="true" />
              Mostrar mi QR
            </a>
          )}

          <div className={`grid gap-2 ${canClases ? "grid-cols-2" : "grid-cols-1"}`}>
            <Link href={`/portal/${slug}/renovar`} className={secondaryClass}>
              <LuRefreshCw className="h-4 w-4" aria-hidden="true" /> Renovar
            </Link>
            {canClases && (
              <Link href={`/portal/${slug}/clases`} className={secondaryClass}>
                <LuCalendarPlus className="h-4 w-4" aria-hidden="true" /> Reservar
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Link
              href={`/portal/${slug}/recibos`}
              className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
            >
              Mis recibos
            </Link>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`qr-${slug}.png`}
                className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
              >
                Descargar QR
              </a>
            )}
          </div>
        </section>

        {/* Próxima clase */}
        {canClases && (
          <section className="flex flex-col gap-4 border border-border bg-surface p-6">
            <p className="font-mono text-etiqueta uppercase text-text-secondary">
              Tu próxima clase
            </p>
            {proximaClase ? (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-text-primary">
                    {proximaClase.clase_nombre}
                  </p>
                  <p className="mt-1 font-mono text-etiqueta uppercase text-text-muted">
                    {fechaCorta(proximaClase.fecha)} ·{" "}
                    {proximaClase.hora_inicio.slice(0, 5)}
                    {proximaClase.estado === "en_lista_espera" &&
                      " · Lista de espera"}
                  </p>
                </div>
                <Link
                  href={`/portal/${slug}/clases`}
                  className="shrink-0 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
                >
                  {reservas.length > 1 ? `Ver ${reservas.length}` : "Ver"}
                </Link>
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-text-muted">
                No tienes clases reservadas.
              </p>
            )}
          </section>
        )}

        {/* Últimas visitas */}
        <section className="flex flex-col gap-4 border border-border bg-surface p-6">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Últimas visitas
          </p>
          <div className="grid grid-cols-7 gap-2">
            {ultimos7.map((d) => {
              const vino = visitados.has(d.ymd);
              return (
                <div key={d.ymd} className="flex flex-col items-center gap-1.5">
                  <span
                    aria-label={vino ? "Viniste" : "No viniste"}
                    className={`h-10 w-full ${
                      vino ? "bg-brand-green" : "border border-border"
                    }`}
                  />
                  <span className="font-mono text-xs uppercase text-text-muted">
                    {d.dia}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {checkins.length} {checkins.length === 1 ? "visita" : "visitas"} en
            30 días
          </p>
        </section>

        {/* Congelar membresía (D7) — solo planes por tiempo */}
        {!porVisitas && (
          <PortalCongelar slug={slug} pendiente={congelacionPendiente} />
        )}

        {/* Mi plan de nutrición (Fase I.6) */}
        {canNutricion && (
          <section className="flex flex-col gap-4 border border-border bg-surface p-6">
            <p className="font-mono text-etiqueta uppercase text-text-secondary">
              Mi plan de nutrición
            </p>
            {planNutricion ? (
              <PlanNutricionCard plan={planNutricion} readOnly />
            ) : (
              <p className="py-2 text-center text-sm text-text-muted">
                Tu entrenador todavía no te asigna un plan.
              </p>
            )}
          </section>
        )}

        {/* Opinión del miembro (Fase P.4) */}
        {canOpiniones && vigente && !opinoEsteMes && (
          <OpinionForm slug={slug} googlePlaceId={googlePlaceId} />
        )}

        <p className="py-4 text-center font-mono text-etiqueta uppercase text-text-muted">
          STRING GYM
        </p>
      </main>
    </div>
  );
}
