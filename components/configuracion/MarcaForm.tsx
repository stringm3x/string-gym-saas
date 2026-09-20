import { getGymMarca } from "@/lib/queries/marca.queries";
import { DEFAULT_COLOR_ACENTO } from "@/lib/validations/marca.schema";
import { MarcaFormClient } from "./MarcaFormClient";

interface MarcaFormProps {
  tenantId: string;
  gymNombre: string;
}

export async function MarcaForm({ tenantId, gymNombre }: MarcaFormProps) {
  const marca = await getGymMarca(tenantId);

  return (
    <MarcaFormClient
      gymNombre={gymNombre}
      logoInicial={marca?.logo_url ?? null}
      colorAcentoInicial={marca?.color_acento ?? DEFAULT_COLOR_ACENTO}
    />
  );
}
