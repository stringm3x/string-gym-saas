import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  getOrCreateApiKey,
  getApiLog,
  countRequestsUltimoMes,
} from "@/lib/queries/api-keys.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { ApiKeyPanel } from "@/components/configuracion/ApiKeyPanel";

export default async function ApiConfigPage() {
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "api")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="API pública"
        descripcion="Conecta tu sitio web externo al SaaS: muestra planes y clases en vivo, recibe reservas y prospectos desde tus formularios."
        beneficios={[
          "API REST con tu propia key",
          "Endpoints de planes, clases, reservas y prospectos",
          "Rate limiting y logs de uso",
          "Documentación con ejemplos",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const [keyInfo, log, requestsMes] = await Promise.all([
    getOrCreateApiKey(tenant.id),
    getApiLog(tenant.id, 20),
    countRequestsUltimoMes(tenant.id),
  ]);

  if (!keyInfo) {
    return (
      <p className="text-sm text-text-secondary">
        No se pudo cargar la API key. Inténtalo de nuevo.
      </p>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="text-sm text-text-secondary">
        Usa esta API key para conectar tu web externa con tu gimnasio.
      </p>
      <div className="pt-2">
        <ApiKeyPanel
          apiKey={keyInfo.api_key}
          ultimoUso={keyInfo.ultimo_uso}
          requestsMes={requestsMes}
          log={log}
        />
      </div>
    </div>
  );
}
