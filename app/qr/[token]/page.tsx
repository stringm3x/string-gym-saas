import { notFound } from "next/navigation";
import { LuRefreshCw } from "react-icons/lu";
import { getMiembroByQrTokenPublic } from "@/lib/queries/qr.queries";
import { generarQRDataUrl } from "@/lib/utils/qr-generator";
import { Badge } from "@/components/ui/Badge";
import { hasFeature, type Plan } from "@/lib/features";
import { MarcasRegistro } from "@/components/arte/MarcasRegistro";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

function hoyYMD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function fechaLarga(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * QR de acceso a pantalla completa. Lo ve el socio en su celular, muchas
 * veces con mala luz: QR grande sobre blanco, estado claro, nada más.
 * Manda el color del gimnasio (misma regla que portal y kiosco).
 */
export default async function QrPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const miembro = await getMiembroByQrTokenPublic(token);
  if (!miembro) notFound();

  const qr = await generarQRDataUrl(miembro.qr_token);
  const vencida =
    !!miembro.fecha_vencimiento && miembro.fecha_vencimiento < hoyYMD();
  const inactivo = miembro.archivado;
  const invalido = vencida || inactivo;

  const estadoLabel = inactivo
    ? "Cuenta inactiva"
    : vencida
      ? "Membresía vencida"
      : "Membresía activa";

  // color_gimnasio está en todos los planes, incluido Starter (plan/02-gating).
  const acento = miembro.gym?.color_acento;
  const aplicaColor =
    !!miembro.gym && hasFeature(miembro.gym.plan as Plan, "color_gimnasio");
  const marcaCss =
    aplicaColor && acento && HEX.test(acento)
      ? `:root{--color-brand-green:${acento};}`
      : null;
  const gymNombre = miembro.gym?.nombre ?? "Gimnasio";
  const inicial = (gymNombre.trim()[0] ?? "G").toUpperCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8">
      {marcaCss && <style dangerouslySetInnerHTML={{ __html: marcaCss }} />}

      <div className="flex w-full max-w-sm flex-col items-center gap-6 border border-border bg-surface p-6 text-center">
        {/* Identidad del gimnasio */}
        {miembro.gym?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={miembro.gym.logo_url}
            alt={gymNombre}
            className="h-12 object-contain"
          />
        ) : (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center bg-brand-green font-display text-xl leading-none text-on-brand"
            >
              {inicial}
            </span>
            <span className="text-base font-semibold text-text-primary">
              {gymNombre}
            </span>
          </div>
        )}

        {/* Nombre del socio: aquí sí entra el cartel */}
        <h1 className="font-display text-titular-m uppercase text-text-primary">
          {miembro.nombre}
        </h1>

        {/* QR sobre blanco puro: los lectores lo prefieren */}
        <div className="relative w-fit">
          <MarcasRegistro className="text-paper-ink/50" />
          <div className="bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR de acceso" className="h-60 w-60" />
          </div>
          {invalido && (
            <div className="absolute inset-0 flex items-center justify-center bg-danger/85">
              <span className="px-4 text-center text-lg font-semibold text-text-primary">
                {estadoLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Badge variant={invalido ? "danger" : "success"}>{estadoLabel}</Badge>
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            Vence {fechaLarga(miembro.fecha_vencimiento)}
          </p>
        </div>

        <a
          href={`/qr/${token}`}
          className="inline-flex h-10 items-center gap-2 text-sm text-text-muted hover:text-text-secondary"
        >
          <LuRefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar
        </a>
      </div>

      <p className="mt-5 text-sm text-text-muted">
        Muestra este código en la entrada del gimnasio.
      </p>
    </div>
  );
}
