import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  getOrCreateApiKey,
  getApiLog,
  countRequestsUltimoMes,
} from "@/lib/queries/api-keys.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { ApiKeyPanel } from "@/components/configuracion/ApiKeyPanel";

export default async function ApiConfigPage() {
  const g = await requirePanel("config.api_regenerar", { sinPermiso: "/configuracion/gym" });
  const tenant = g.ctx;

  if (!g.ok) {
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
        planRequerido={g.planRequerido}
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
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">API pública</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Usa esta API key para conectar tu web externa con tu gimnasio.
        </p>
      </div>
      <ApiKeyPanel
        apiKey={keyInfo.api_key}
        ultimoUso={keyInfo.ultimo_uso}
        requestsMes={requestsMes}
        log={log}
      />
    </div>
  );
}
