import { notFound } from "next/navigation";
import { LuRefreshCw } from "react-icons/lu";
import { getMiembroByQrTokenPublic } from "@/lib/queries/qr.queries";
import { generarQRDataUrl } from "@/lib/utils/qr-generator";

export const dynamic = "force-dynamic";

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
      : "Activo";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-6 text-center">
        {/* Logo del gym */}
        {miembro.gym?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={miembro.gym.logo_url}
            alt={miembro.gym?.nombre ?? ""}
            className="mx-auto h-12 object-contain"
          />
        ) : (
          <p className="font-display text-xl uppercase tracking-wide text-text-primary">
            {miembro.gym?.nombre ?? "Gym"}
          </p>
        )}

        {/* Nombre del miembro */}
        <h1 className="font-display text-2xl uppercase tracking-wide text-text-primary">
          {miembro.nombre}
        </h1>

        {/* QR */}
        <div className="relative mx-auto w-fit">
          <div className="rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR de acceso" className="h-56 w-56" />
          </div>
          {invalido && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-danger/80">
              <span className="px-3 text-center text-sm font-semibold text-white">
                {estadoLabel}
              </span>
            </div>
          )}
        </div>

        {/* Estado */}
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            invalido
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-brand-green/30 bg-brand-green/10 text-brand-green"
          }`}
        >
          {estadoLabel}
        </span>

        {/* Vencimiento */}
        <p className="text-sm text-text-secondary">
          Vence: {fechaLarga(miembro.fecha_vencimiento)}
        </p>

        {/* Actualizar */}
        <a
          href={`/qr/${token}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
        >
          <LuRefreshCw className="h-3.5 w-3.5" /> Actualizar
        </a>
      </div>

      <p className="mt-4 text-[11px] text-text-muted">
        Muestra este código en la entrada del gimnasio.
      </p>
    </div>
  );
}
