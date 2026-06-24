import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Pública — STRING GYM",
  description: "Documentación de la API REST pública de STRING GYM.",
};

const BASE = "https://app.gym.stringwebs.com/api/v1/{slug}";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-text-primary">
      {children}
    </pre>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  const color =
    method === "GET"
      ? "text-brand-green"
      : method === "POST"
        ? "text-warning"
        : "text-danger";
  return (
    <section className="space-y-2 border-t border-border pt-6">
      <h3 className="flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className={`font-semibold ${color}`}>{method}</span>
        <span className="text-text-primary">{path}</span>
      </h3>
      {children}
    </section>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-12 text-text-primary">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            STRING<span className="text-brand-green">GYM</span> · API
          </h1>
          <p className="text-sm text-text-secondary">
            API REST pública para conectar tu sitio web con tu gimnasio:
            planes, clases, reservas y prospectos en vivo.
          </p>
        </header>

        {/* SDK */}
        <section className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <h2 className="text-sm font-semibold text-brand-green">
            ¿Prefieres no escribir fetch?
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Usa el{" "}
            <Link href="/sdk-docs" className="text-brand-green hover:underline">
              SDK de integración
            </Link>
            : componentes HTML (<code>&lt;string-gym-planes&gt;</code>,{" "}
            <code>&lt;string-gym-form&gt;</code>…) que se conectan solos a esta
            API. Ideal para landing pages.
          </p>
        </section>

        {/* Autenticación */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Autenticación</h2>
          <p className="text-sm text-text-secondary">
            Los endpoints de <strong>lectura</strong> (<code>GET /planes</code>,{" "}
            <code>/clases</code>, <code>/info</code>) son <strong>públicos</strong>:
            solo necesitan el slug del gym. Los de <strong>escritura</strong>{" "}
            (<code>POST /reservas</code>, <code>/prospectos</code>) requieren la
            API key (formato <code>sgk_…</code>, en <em>Configuración → API</em>)
            en el header <code>Authorization</code>:
          </p>
          <Code>{`Authorization: Bearer sgk_tu_api_key`}</Code>
          <p className="text-sm text-text-secondary">
            Base URL (reemplaza <code>{"{slug}"}</code> por el de tu gym):
          </p>
          <Code>{BASE}</Code>
        </section>

        {/* Formato */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Formato de respuesta</h2>
          <Code>{`// Éxito
{ "data": { ... }, "meta": { "timestamp": "ISO", "slug": "gym-demo" } }

// Error
{ "error": { "code": "UNAUTHORIZED", "message": "..." }, "meta": { ... } }`}</Code>
        </section>

        {/* Endpoints */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Endpoints</h2>

          <Endpoint method="GET" path="/planes">
            <p className="text-sm text-text-secondary">
              Planes de membresía activos.
            </p>
            <Code>{`{ "data": [
  { "id": "...", "nombre": "Mensual", "precio": 500,
    "duracion_dias": 30, "descripcion": null, "activo": true }
] }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/clases?desde=&hasta=&tipo=">
            <p className="text-sm text-text-secondary">
              Sesiones de clases disponibles. <code>desde</code>/
              <code>hasta</code> en <code>YYYY-MM-DD</code> (default: hoy y
              hoy+7). <code>tipo</code>: regular/gratis/taller/privada.
            </p>
            <Code>{`{ "data": [
  { "sesion_id": "...", "clase_nombre": "Box", "clase_tipo": "regular",
    "clase_color": "#10b981", "instructor": "Ana", "fecha": "2026-07-01",
    "hora_inicio": "07:00", "hora_fin": "08:00", "duracion_minutos": 60,
    "cupo_maximo": 15, "cupo_disponible": 4, "disponible": true }
] }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/reservas">
            <p className="text-sm text-text-secondary">
              Crea una reserva. Si no hay cupo, entra en lista de espera. Si la
              clase es de tipo <code>gratis</code>, se crea un prospecto en el
              CRM automáticamente.
            </p>
            <Code>{`// body
{ "sesion_id": "...", "nombre": "Juan", "telefono": "5551234567",
  "email": "juan@mail.com", "miembro_id": null }

// respuesta
{ "data": { "reserva_id": "...", "estado": "confirmada",
  "mensaje": "Tu lugar está confirmado." } }`}</Code>
          </Endpoint>

          <Endpoint method="DELETE" path="/reservas/{reservaId}">
            <p className="text-sm text-text-secondary">
              Cancela una reserva. Promueve automáticamente al primero de la
              lista de espera.
            </p>
            <Code>{`{ "data": { "cancelada": true, "mensaje": "Reserva cancelada." } }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/prospectos">
            <p className="text-sm text-text-secondary">
              Crea un prospecto desde un formulario de tu web.
            </p>
            <Code>{`// body
{ "nombre": "Ana", "telefono": "5559876543", "email": "ana@mail.com",
  "mensaje": "Quiero info de planes", "origen_detalle": "formulario-contacto" }

// respuesta
{ "data": { "prospecto_id": "...", "mensaje": "¡Gracias! Te contactaremos pronto." } }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/info">
            <p className="text-sm text-text-secondary">
              Información pública del gym. <strong>No requiere API key.</strong>
            </p>
            <Code>{`{ "data": { "nombre": "Mi Gym", "slug": "mi-gym", "logo_url": "...",
  "color_acento": "#10b981", "direccion": "...", "telefono": "...",
  "whatsapp": null, "horarios": null } }`}</Code>
          </Endpoint>
        </section>

        {/* Ejemplo */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Ejemplo (JavaScript)</h2>
          <Code>{`const API = "https://app.gym.stringwebs.com/api/v1/mi-gym";
const KEY = "sgk_tu_api_key";

// Listar clases de la semana
const res = await fetch(\`\${API}/clases\`, {
  headers: { Authorization: \`Bearer \${KEY}\` },
});
const { data } = await res.json();

// Crear una reserva
await fetch(\`\${API}/reservas\`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${KEY}\`,
  },
  body: JSON.stringify({
    sesion_id: data[0].sesion_id,
    nombre: "Juan",
    telefono: "5551234567",
  }),
});`}</Code>
        </section>

        {/* Rate limit + errores */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Rate limiting</h2>
          <p className="text-sm text-text-secondary">
            Máximo <strong>100 requests por minuto</strong> por API key. Al
            excederlo, la API responde <code>429 Too Many Requests</code> con el
            código <code>RATE_LIMITED</code>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Errores</h2>
          <Code>{`401 UNAUTHORIZED        — falta o es inválida la API key
403 FORBIDDEN           — la key no corresponde a ese gym
404 NOT_FOUND           — gym o recurso inexistente
404 SESION_NO_ENCONTRADA / RESERVA_NO_ENCONTRADA
409 SESION_CANCELADA    — la sesión está cancelada
400 VALIDATION_ERROR    — datos del body inválidos
429 RATE_LIMITED        — límite de requests excedido`}</Code>
        </section>

        <footer className="border-t border-border pt-6 text-xs text-text-muted">
          STRING GYM API v1 · Las respuestas incluyen headers CORS para
          consumirse desde el navegador.
        </footer>
      </div>
    </div>
  );
}
