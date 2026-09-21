import Image from "next/image";
import Link from "next/link";
import { LuQrCode, LuMonitor } from "react-icons/lu";
import { requirePanel } from "@/lib/authz/pagina";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  listCheckinsDeHoy,
  countCheckinsDeHoy,
} from "@/lib/queries/checkins.queries";
import { getCodigosPendientes, limpiarExpirados } from "@/lib/queries/kiosco.queries";
import { TZ_MX } from "@/lib/utils/dates";
import { CheckinKiosk } from "@/components/checkins/CheckinKiosk";
import { CheckinsFeed } from "@/components/checkins/CheckinsFeed";
import { AutorizacionesPendientes } from "@/components/caja/AutorizacionesPendientes";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function fechaHoy(): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ_MX,
  }).format(new Date());
}

/**
 * Check-in del staff. Se usa en tablet: buscador y filas de 44px, la
 * confirmación en grande y las entradas del día debajo.
 */
export default async function CheckinsPage({ params }: PageProps) {
  const { slug } = await params;
  const g = await requirePanel("checkins.registrar", { sinPermiso: "/miembros" });
  if (!g.ok) return null; // checkins es Starter: no ocurre
  const tenant = g.ctx;

  const canAutoservicio =
    hasFeature(tenant.plan, "kiosco_autoservicio") &&
    hasPermission(tenant.role, "registrar_pagos");
  if (canAutoservicio) await limpiarExpirados(tenant.id);

  const [gym, checkins, total, codigosPendientes] = await Promise.all([
    getGymInfo(tenant.id),
    listCheckinsDeHoy(tenant.id, 30),
    countCheckinsDeHoy(tenant.id),
    canAutoservicio ? getCodigosPendientes(tenant.id) : Promise.resolve([]),
  ]);

  const canQr = hasFeature(tenant.plan, "qr_access");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          {gym?.logo_url ? (
            <Image
              src={gym.logo_url}
              alt={gym.nombre}
              width={240}
              height={80}
              unoptimized
              priority
              className="mb-2 h-10 w-auto max-w-[200px] object-contain object-left"
            />
          ) : null}
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            {fechaHoy()}
          </p>
          <h2 className="text-pagina font-semibold text-text-primary">
            Check-in
          </h2>
        </div>

        {canQr && (
          <div className="flex items-center gap-3">
            <a
              href={`/kiosco/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
            >
              <LuMonitor className="h-4 w-4" aria-hidden="true" /> Modo kiosco
            </a>
            <Link
              href={`/${slug}/checkins/scanner`}
              className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
            >
              <LuQrCode className="h-4 w-4" aria-hidden="true" /> Escanear QR
            </Link>
          </div>
        )}
      </div>

      <CheckinKiosk />

      {canAutoservicio && <AutorizacionesPendientes codigos={codigosPendientes} />}

      <section className="card-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">
            Entradas de hoy
          </h3>
          <span className="font-mono text-etiqueta tabular-nums text-text-muted">
            {total}
          </span>
        </div>
        <CheckinsFeed checkins={checkins} slug={slug} />
      </section>
    </div>
  );
}
