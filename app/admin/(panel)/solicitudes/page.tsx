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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Solicitudes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Solicitudes de prueba desde el pre-registro. Actívalas para crear el
          gym y su owner, o márcalas como contactadas/descartadas.
        </p>
      </div>

      <SolicitudesList solicitudes={solicitudes} />
    </div>
  );
}
