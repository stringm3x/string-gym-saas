import { getGymMarca } from "@/lib/queries/marca.queries";
import { hasFeature, type Plan } from "@/lib/features";
import {
  DEFAULT_COLOR_ACENTO,
  DEFAULT_COLOR_SIDEBAR,
} from "@/lib/validations/marca.schema";
import { MarcaFormClient } from "./MarcaFormClient";

interface MarcaFormProps {
  tenantId: string;
  plan: Plan;
  gymNombre: string;
}

export async function MarcaForm({ tenantId, plan, gymNombre }: MarcaFormProps) {
  const marca = await getGymMarca(tenantId);

  return (
    <MarcaFormClient
      gymNombre={gymNombre}
      logoInicial={marca?.logo_url ?? null}
      colorAcentoInicial={marca?.color_acento ?? DEFAULT_COLOR_ACENTO}
      colorSidebarInicial={marca?.color_sidebar ?? DEFAULT_COLOR_SIDEBAR}
      canColors={hasFeature(plan, "personalizacion_colores")}
    />
  );
}
