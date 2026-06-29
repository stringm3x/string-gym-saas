import Image from "next/image";
import Link from "next/link";
import { LuQrCode, LuMonitor } from "react-icons/lu";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  listCheckinsDeHoy,
  countCheckinsDeHoy,
} from "@/lib/queries/checkins.queries";
import { CheckinKiosk } from "@/components/checkins/CheckinKiosk";
import { CheckinsFeed } from "@/components/checkins/CheckinsFeed";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckinsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const [gym, checkins, total] = await Promise.all([
    getGymInfo(tenant.id),
    listCheckinsDeHoy(tenant.id, 30),
    countCheckinsDeHoy(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col items-center gap-3 text-center">
        {gym?.logo_url ? (
          <Image
            src={gym.logo_url}
            alt={gym.nombre}
            width={240}
            height={80}
            unoptimized
            priority
            className="h-16 w-auto max-w-[240px] object-contain"
          />
        ) : null}
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
            Check-in
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Busca al miembro y registra su entrada con un click.
          </p>
        </div>
      </div>

      {hasFeature(tenant.plan, "qr_access") && (
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/${slug}/checkins/scanner`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-green/40 bg-brand-green/10 px-4 py-2.5 text-sm font-semibold text-brand-green hover:bg-brand-green/20"
          >
            <LuQrCode className="h-4 w-4" /> Escanear QR
          </Link>
          <a
            href={`/kiosco/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <LuMonitor className="h-4 w-4" /> Modo Kiosco
          </a>
        </div>
      )}

      <CheckinKiosk />

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Check-ins de hoy
          </h3>
          <span className="font-mono text-xs text-text-secondary tabular-nums">
            {total} {total === 1 ? "entrada" : "entradas"}
          </span>
        </div>

        <CheckinsFeed checkins={checkins} slug={slug} />
      </div>
    </div>
  );
}
