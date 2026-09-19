import Link from "next/link";
import { LuArrowLeft, LuReceipt } from "react-icons/lu";
import { requirePortal } from "@/lib/portal/session";
import { getRecibosPortal } from "@/lib/queries/portal.queries";
import { money } from "@/lib/utils/creditos-calc";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <Link
          href={`/portal/${slug}`}
          className="inline-flex h-10 items-center gap-2 self-start text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </Link>

        <h1 className="text-pagina font-semibold text-text-primary">Mis recibos</h1>

        {recibos.length === 0 ? (
          <EmptyState
            icon={<LuReceipt />}
            title="Sin recibos"
            description="Cada pago que hagas en el gimnasio queda aquí con su recibo para imprimir."
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {recibos.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-dato tabular-nums text-text-primary">
                    {money(r.monto)}
                  </p>
                  <p className="mt-0.5 font-mono text-etiqueta uppercase text-text-muted">
                    {CONCEPTO_LABEL[r.concepto] ?? r.concepto} ·{" "}
                    {fecha(r.fecha_pago)}
                  </p>
                </div>
                <a
                  href={`/recibos/${r.token_publico}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 shrink-0 items-center border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
                >
                  Ver recibo
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
