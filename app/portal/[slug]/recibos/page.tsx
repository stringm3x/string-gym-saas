import Link from "next/link";
import { LuArrowLeft, LuDownload } from "react-icons/lu";
import { requirePortal } from "@/lib/portal/session";
import { getRecibosPortal } from "@/lib/queries/portal.queries";
import { money } from "@/lib/utils/creditos-calc";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { TZ_MX } from "@/lib/utils/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const CONCEPTO_LABEL: Record<string, string> = {
  membresia: "Membresía",
  producto: "Producto",
  visita: "Visita",
  otro: "Otro",
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalRecibosPage({ params }: PageProps) {
  const { slug } = await params;
  const { gym, session } = await requirePortal(slug);
  const recibos = await getRecibosPortal(gym.id, session.miembroId);

  return (
    <div className="min-h-screen">
      <PortalHeader slug={slug} gymNombre={gym.nombre} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <Link
          href={`/portal/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>

        <h1 className="text-lg font-semibold text-text-primary">Mis recibos</h1>

        {recibos.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
            Aún no tienes recibos.
          </p>
        ) : (
          <ul className="space-y-2">
            {recibos.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {money(r.monto)}
                    <span className="ml-2 text-xs font-normal text-text-secondary">
                      {CONCEPTO_LABEL[r.concepto] ?? r.concepto}
                    </span>
                  </p>
                  <p className="text-xs text-text-secondary">
                    {fecha(r.fecha_pago)}
                  </p>
                </div>
                <a
                  href={`/recibos/${r.token_publico}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-green hover:text-brand-green"
                >
                  <LuDownload className="h-3.5 w-3.5" /> Recibo
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
