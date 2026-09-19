import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getMiembro, listReferidos } from "@/lib/queries/miembros.queries";
import { listCheckinsByMiembro } from "@/lib/queries/checkins.queries";
import { listPagosByMiembro } from "@/lib/queries/pagos.queries";
import { listTags, getTagsForMiembro } from "@/lib/queries/tags.queries";
import { listNotas } from "@/lib/queries/notas.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { hoyISO, hoyCDMX } from "@/lib/utils/dates";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { NotasTimeline } from "@/components/miembros/NotasTimeline";
import { NotasLegacy } from "@/components/miembros/NotasLegacy";
import { AccionesRapidas } from "@/components/ui/AccionesRapidas";
import { MiembroStatusBadge } from "@/components/miembros/MiembroStatusBadge";
import { RiesgoInactividadBadge } from "@/components/miembros/RiesgoInactividadBadge";
import { MiembroArchivarButton } from "@/components/miembros/MiembroArchivarButton";
import { RenovarButton } from "@/components/miembros/RenovarButton";
import { MembresiaAcciones } from "@/components/miembros/MembresiaAcciones";
import { EventosTimeline } from "@/components/miembros/EventosTimeline";
import { CongelacionSolicitudes } from "@/components/miembros/CongelacionSolicitudes";
import {
  getEventosMiembro,
  getCongelacionesSolicitadas,
  congelacionActiva,
} from "@/lib/queries/miembro-eventos.queries";
import { MiembroArchivadoBanner } from "@/components/miembros/MiembroArchivadoBanner";
import { ManualCheckinButton } from "@/components/checkins/ManualCheckinButton";
import { CheckinsHistory } from "@/components/checkins/CheckinsHistory";
import { PagosHistory } from "@/components/caja/PagosHistory";
import { getReservasByMiembro } from "@/lib/queries/clases.queries";
import { MiembroClasesHistorial } from "@/components/clases/MiembroClasesHistorial";
import type { ReservaMiembro } from "@/lib/types/clases";
import { getMiembroQrData, type MiembroQrData } from "@/lib/queries/qr.queries";
import { generarQRDataUrl } from "@/lib/utils/qr-generator";
import { MiembroQrPanel } from "@/components/miembros/MiembroQrPanel";
import { getPlanesPagoByMiembro } from "@/lib/queries/creditos.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { listProductosConStock } from "@/lib/queries/productos.queries";
import { MiembroCreditos } from "@/components/creditos/MiembroCreditos";
import type { PlanPagoConCuotas } from "@/lib/types/creditos";
import {
  getPlanesNutricion,
  type PlanNutricion,
} from "@/lib/queries/nutricion.queries";
import { MiembroNutricion } from "@/components/nutricion/MiembroNutricion";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function MiembroDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getTenant();
  const canClases = hasFeature(tenant.plan, "clases");
  const canQr = hasFeature(tenant.plan, "qr_access");
  const canCreditos = hasFeature(tenant.plan, "creditos");
  const canNutricion =
    hasFeature(tenant.plan, "nutricion") &&
    hasPermission(tenant.role, "ver_nutricion");

  const [
    miembro,
    checkins,
    pagos,
    miembroTags,
    availableTags,
    notas,
    plantillas,
    gym,
    reservasClases,
    qrData,
    planesPago,
    planesMembresia,
    productosStock,
    planesNutricion,
    eventosMembresia,
    congelacionesPendientes,
    tieneCongelacionActiva,
  ] = await Promise.all([
    getMiembro(tenant.id, id),
    listCheckinsByMiembro(tenant.id, id, 20),
    listPagosByMiembro(tenant.id, id, 30),
    getTagsForMiembro(tenant.id, id),
    listTags(tenant.id),
    listNotas(tenant.id, "miembro", id),
    listPlantillas(tenant.id, { soloActivas: true }),
    getGymInfo(tenant.id),
    canClases
      ? getReservasByMiembro(tenant.id, id)
      : Promise.resolve([] as ReservaMiembro[]),
    canQr
      ? getMiembroQrData(tenant.id, id)
      : Promise.resolve(null as MiembroQrData | null),
    canCreditos
      ? getPlanesPagoByMiembro(tenant.id, id)
      : Promise.resolve([] as PlanPagoConCuotas[]),
    listPlanes(tenant.id, { soloActivos: true }),
    canCreditos
      ? listProductosConStock(tenant.id)
      : Promise.resolve([]),
    canNutricion
      ? getPlanesNutricion(tenant.id, id)
      : Promise.resolve([] as PlanNutricion[]),
    getEventosMiembro(tenant.id, id),
    getCongelacionesSolicitadas(tenant.id, id),
    congelacionActiva(tenant.id, id),
  ]);

  if (!miembro) {
    notFound();
  }

  const [qrDataUrl, referidoPor, referidos] = await Promise.all([
    canQr && qrData ? generarQRDataUrl(qrData.qr_token) : Promise.resolve(null),
    miembro.referido_por
      ? getMiembro(tenant.id, miembro.referido_por)
      : Promise.resolve(null),
    listReferidos(tenant.id, miembro.id),
  ]);

  const canTags = hasFeature(tenant.plan, "tags");
  const canTimeline = hasFeature(tenant.plan, "timeline_notas");
  const canPlantillas = hasFeature(tenant.plan, "plantillas_mensaje");
  const canArchivar = hasPermission(tenant.role, "eliminar_archivar_miembros");
  const canCobrar = hasPermission(tenant.role, "registrar_pagos");
  const canPortal = hasFeature(tenant.plan, "portal_miembro");
  const portalUrl = canPortal
    ? `https://${process.env.APP_DOMAIN ?? "app.gym.stringwebs.com"}/portal/${slug}/login`
    : null;

  const miembroConTags = { ...miembro, tags: miembroTags };

  // Riesgo de inactividad: mismo umbral (14+ días sin check-in) que dispara
  // el aviso automático al dueño, pero visible aquí en el momento en que el
  // staff está viendo la ficha — no solo una vez al día por WhatsApp.
  const vigente =
    !miembro.archivado &&
    !!miembro.fecha_vencimiento &&
    miembro.fecha_vencimiento >= hoyISO();
  const diasSinCheckin = checkins[0]
    ? Math.floor(
        (hoyCDMX().getTime() - new Date(checkins[0].fecha_hora).getTime()) /
          86_400_000
      )
    : null;
  const enRiesgo = vigente && diasSinCheckin !== null && diasSinCheckin >= 14;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex h-9 items-center gap-1.5 self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
          Miembros
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-pagina font-semibold text-text-primary">
              {miembro.nombre}
            </h2>
            <MiembroStatusBadge
              fechaVencimiento={miembro.fecha_vencimiento}
              visitasRestantes={miembro.visitas_restantes}
            />
            {enRiesgo &&
              diasSinCheckin !== null &&
              hasFeature(tenant.plan, "riesgo_panel") && (
                <RiesgoInactividadBadge dias={diasSinCheckin} />
              )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              {!miembro.archivado && canCobrar && (
                <RenovarButton
                  slug={slug}
                  miembroId={miembro.id}
                  planActualId={miembro.plan_id}
                  fechaVencimiento={miembro.fecha_vencimiento}
                  planes={planesMembresia}
                />
              )}
              <ManualCheckinButton
                miembroId={miembro.id}
                miembroNombre={miembro.nombre}
                disabled={miembro.archivado}
                disabledTitle="Restaura para realizar acciones"
              />
            </div>

            {!miembro.archivado &&
              hasPermission(tenant.role, "editar_miembros") && (
                <>
                  <ToolbarDivider />
                  <MembresiaAcciones
                    miembroId={miembro.id}
                    planes={planesMembresia}
                    congelacionActiva={tieneCongelacionActiva}
                  />
                </>
              )}

            <ToolbarDivider />
            <AccionesRapidas
              nombre={miembro.nombre}
              telefono={miembro.telefono}
              email={miembro.email}
              fechaVencimiento={miembro.fecha_vencimiento}
              gymNombre={gym?.nombre}
              entidadTipo="miembro"
              entidadId={miembro.id}
              plantillas={canPlantillas ? plantillas : []}
              portalUrl={portalUrl}
              canWhatsapp={hasFeature(tenant.plan, "whatsapp_manual")}
            />

            {!miembro.archivado && canArchivar && (
              <>
                <ToolbarDivider />
                <MiembroArchivarButton
                  miembroId={miembro.id}
                  miembroNombre={miembro.nombre}
                />
              </>
            )}
          </div>
        </div>

        {(referidoPor || referidos.length > 0) && (
          <p className="text-sm text-text-secondary">
            {referidoPor && (
              <>
                Referido por{" "}
                <Link
                  href={`/${slug}/miembros/${referidoPor.id}`}
                  className="text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
                >
                  {referidoPor.nombre}
                </Link>
              </>
            )}
            {referidoPor && referidos.length > 0 && " · "}
            {referidos.length > 0 &&
              `${referidos.length} ${referidos.length === 1 ? "referido" : "referidos"} activos`}
          </p>
        )}
      </div>

      {miembro.archivado && (
        <MiembroArchivadoBanner
          miembroId={miembro.id}
          archivadoAt={miembro.archivado_at}
          canRestore={canArchivar}
        />
      )}

      <div className="border border-border bg-surface p-6">
        <MiembroForm
          mode="edit"
          slug={slug}
          miembro={miembroConTags}
          referidoPorNombre={referidoPor?.nombre ?? null}
          availableTags={canTags ? availableTags : []}
          disabled={miembro.archivado}
        />
      </div>

      {hasPermission(tenant.role, "editar_miembros") &&
        congelacionesPendientes.length > 0 && (
          <CongelacionSolicitudes
            miembroId={miembro.id}
            solicitudes={congelacionesPendientes}
          />
        )}

      {/* Con timeline unificado (Pro+), los eventos de membresía se fusionan
          dentro de NotasTimeline en vez de mostrarse en un bloque aparte. */}
      {!canTimeline && eventosMembresia.length > 0 && (
        <EventosTimeline eventos={eventosMembresia} />
      )}

      <div className="border border-border bg-surface p-6">
        {canTimeline ? (
          <NotasTimeline
            entidadTipo="miembro"
            entidadId={id}
            notas={notas}
            legacyNotas={miembro.notas}
            eventos={eventosMembresia}
          />
        ) : (
          <NotasLegacy miembroId={miembro.id} notas={miembro.notas} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface self-start">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-text-primary">
              Pagos
            </h3>
            <span className="font-mono text-etiqueta text-text-muted">
              {pagos.length}
            </span>
          </div>
          <PagosHistory pagos={pagos} slug={slug} />
        </section>

        <section className="card-surface self-start">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-text-primary">
              Check-ins
            </h3>
            <span className="font-mono text-etiqueta text-text-muted">
              {checkins.length}
            </span>
          </div>
          <CheckinsHistory checkins={checkins} />
        </section>
      </div>

      {canClases && <MiembroClasesHistorial reservas={reservasClases} />}

      {canQr && qrData && qrDataUrl && (
        <MiembroQrPanel
          qrDataUrl={qrDataUrl}
          token={qrData.qr_token}
          telefono={miembro.telefono}
          nombre={miembro.nombre}
          miembroId={miembro.id}
          canRegenerar={tenant.role === "owner"}
        />
      )}

      {canNutricion && (
        <MiembroNutricion
          miembroId={miembro.id}
          planes={planesNutricion}
          disabled={miembro.archivado}
        />
      )}

      {canCreditos && !miembro.archivado && (
        <MiembroCreditos
          miembroId={miembro.id}
          miembroNombre={miembro.nombre}
          planes={planesPago}
          planesMembresia={planesMembresia}
          productos={productosStock.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio,
            stock: p.stock_actual,
          }))}
        />
      )}
    </div>
  );
}

function ToolbarDivider() {
  return <span className="hidden h-6 w-px shrink-0 bg-border sm:block" />;
}
