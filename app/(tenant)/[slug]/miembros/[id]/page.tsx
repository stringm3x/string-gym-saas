import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { listCheckinsByMiembro } from "@/lib/queries/checkins.queries";
import { listPagosByMiembro } from "@/lib/queries/pagos.queries";
import { listTags, getTagsForMiembro } from "@/lib/queries/tags.queries";
import { listNotas } from "@/lib/queries/notas.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { MiembroForm } from "@/components/miembros/MiembroForm";
import { NotasTimeline } from "@/components/miembros/NotasTimeline";
import { NotasLegacy } from "@/components/miembros/NotasLegacy";
import { AccionesRapidas } from "@/components/ui/AccionesRapidas";
import { MiembroStatusBadge } from "@/components/miembros/MiembroStatusBadge";
import { MiembroArchivarButton } from "@/components/miembros/MiembroArchivarButton";
import { RenovarButton } from "@/components/miembros/RenovarButton";
import { MembresiaAcciones } from "@/components/miembros/MembresiaAcciones";
import { EventosTimeline } from "@/components/miembros/EventosTimeline";
import { getEventosMiembro } from "@/lib/queries/miembro-eventos.queries";
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
  const canNutricion = hasFeature(tenant.plan, "nutricion");

  const [
    miembro,
    checkins,
    pagos,
    miembroTags,
    availableTags,
    notas,
    plantillas,
    reservasClases,
    qrData,
    planesPago,
    planesMembresia,
    productosStock,
    planesNutricion,
    eventosMembresia,
  ] = await Promise.all([
    getMiembro(tenant.id, id),
    listCheckinsByMiembro(tenant.id, id, 20),
    listPagosByMiembro(tenant.id, id, 30),
    getTagsForMiembro(tenant.id, id),
    listTags(tenant.id),
    listNotas(tenant.id, "miembro", id),
    listPlantillas(tenant.id, { soloActivas: true }),
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
  ]);

  if (!miembro) {
    notFound();
  }

  const qrDataUrl =
    canQr && qrData ? await generarQRDataUrl(qrData.qr_token) : null;

  const canTags = hasFeature(tenant.plan, "tags");
  const canTimeline = hasFeature(tenant.plan, "timeline_notas");
  const canPlantillas = hasFeature(tenant.plan, "plantillas_mensaje");
  const canArchivar = hasPermission(tenant.role, "eliminar_archivar_miembros");
  const canCobrar = hasPermission(tenant.role, "registrar_pagos");

  const miembroConTags = { ...miembro, tags: miembroTags };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Volver a miembros
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
              {miembro.nombre}
            </h2>
            <MiembroStatusBadge
              fechaVencimiento={miembro.fecha_vencimiento}
              visitasRestantes={miembro.visitas_restantes}
            />
          </div>

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
            {!miembro.archivado &&
              hasPermission(tenant.role, "editar_miembros") && (
                <MembresiaAcciones
                  miembroId={miembro.id}
                  planes={planesMembresia}
                />
              )}
            <AccionesRapidas
              nombre={miembro.nombre}
              telefono={miembro.telefono}
              email={miembro.email}
              fechaVencimiento={miembro.fecha_vencimiento}
              entidadTipo="miembro"
              entidadId={miembro.id}
              plantillas={canPlantillas ? plantillas : []}
            />
            <ManualCheckinButton
              miembroId={miembro.id}
              miembroNombre={miembro.nombre}
              disabled={miembro.archivado}
              disabledTitle="Restaura para realizar acciones"
            />
            {!miembro.archivado && canArchivar && (
              <MiembroArchivarButton
                miembroId={miembro.id}
                miembroNombre={miembro.nombre}
              />
            )}
          </div>
        </div>
      </div>

      {miembro.archivado && (
        <MiembroArchivadoBanner
          miembroId={miembro.id}
          archivadoAt={miembro.archivado_at}
          canRestore={canArchivar}
        />
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <MiembroForm
          mode="edit"
          slug={slug}
          miembro={miembroConTags}
          availableTags={canTags ? availableTags : []}
          disabled={miembro.archivado}
        />
      </div>

      {eventosMembresia.length > 0 && (
        <EventosTimeline eventos={eventosMembresia} />
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        {canTimeline ? (
          <NotasTimeline
            entidadTipo="miembro"
            entidadId={id}
            notas={notas}
            legacyNotas={miembro.notas}
          />
        ) : (
          <NotasLegacy miembroId={miembro.id} notas={miembro.notas} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Historial de pagos
          </h3>
          <PagosHistory pagos={pagos} slug={slug} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Historial de check-ins
          </h3>
          <CheckinsHistory checkins={checkins} />
        </div>
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
