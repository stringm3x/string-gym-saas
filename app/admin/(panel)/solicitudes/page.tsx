import { getSolicitudes } from "@/lib/queries/solicitudes.queries";
import { SolicitudesList } from "@/components/admin/SolicitudesList";

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const estadoRaw = sp.estado;
  const estado = typeof estadoRaw === "string" ? estadoRaw : undefined;

  const solicitudes = await getSolicitudes({ estado });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Panel interno
        </p>
        <h1 className="text-pagina font-semibold text-text-primary">
          Solicitudes
        </h1>
        <p className="text-sm text-text-secondary">
          Solicitudes de prueba desde el pre-registro. Actívalas para crear el
          gimnasio y su dueño, o márcalas como contactadas o descartadas.
        </p>
      </div>

      <SolicitudesList solicitudes={solicitudes} />
    </div>
  );
}
