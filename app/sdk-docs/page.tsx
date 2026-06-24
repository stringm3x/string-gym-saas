import type { Metadata } from "next";
import Link from "next/link";
import { STRING_SOPORTE_WHATSAPP } from "@/lib/constants";

export const metadata: Metadata = {
  title: "SDK de Integración — STRING GYM",
  description:
    "SDK JavaScript para conectar tu web con STRING GYM: planes, clases y formularios en vivo.",
};

const SDK_SRC = "https://app.gym.stringwebs.com/sdk/string-gym.js";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-text-primary">
      {children}
    </pre>
  );
}

function AttrTable({
  rows,
}: {
  rows: [string, string, string, string][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-surface text-left uppercase tracking-wide text-text-muted">
            <th className="px-3 py-2 font-medium">Atributo</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-text-primary">{r[0]}</td>
              <td className="px-3 py-2 text-text-secondary">{r[1]}</td>
              <td className="px-3 py-2 text-text-muted">{r[2]}</td>
              <td className="px-3 py-2 text-text-secondary">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Comp({
  tag,
  desc,
  rows,
  example,
}: {
  tag: string;
  desc: string;
  rows: [string, string, string, string][];
  example: string;
}) {
  return (
    <section className="space-y-2 border-t border-border pt-6">
      <h3 className="font-mono text-sm font-semibold text-brand-green">
        {tag}
      </h3>
      <p className="text-sm text-text-secondary">{desc}</p>
      <AttrTable rows={rows} />
      <Code>{example}</Code>
    </section>
  );
}

export default function SdkDocsPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-12 text-text-primary">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            STRING<span className="text-brand-green">GYM</span> · SDK
          </h1>
          <p className="text-sm text-text-secondary">
            Conecta tu sitio web a STRING GYM con componentes listos para usar.
            Sin frameworks: funciona en cualquier web.
          </p>
        </header>

        {/* 1. Inicio rápido */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Inicio rápido</h2>
          <p className="text-sm text-text-secondary">
            Incluye el script una vez y usa los componentes donde quieras.
            Reemplaza <code>TU-SLUG</code> por el de tu gym.
          </p>
          <Code>{`<script src="${SDK_SRC}"></script>

<string-gym-planes gym="TU-SLUG"></string-gym-planes>`}</Code>
          <p className="text-sm text-text-secondary">
            Los componentes de lectura (<code>info</code>, <code>planes</code>,{" "}
            <code>calendario</code>) solo necesitan el slug. Para enviar
            formularios o reservar se requiere tu <code>api-key</code>.
          </p>
        </section>

        {/* 2. Referencia */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">2. Componentes</h2>

          <Comp
            tag="<string-gym-info>"
            desc="Muestra el nombre y logo del gym."
            rows={[["gym", "string", "—", "Slug del gym (requerido)."]]}
            example={`<string-gym-info gym="TU-SLUG"></string-gym-info>`}
          />

          <Comp
            tag="<string-gym-planes>"
            desc="Cards con los planes de membresía activos."
            rows={[
              ["gym", "string", "—", "Slug del gym (requerido)."],
              ["cta-texto", "string", '"Me interesa"', "Texto del botón."],
              ["cta-form", "string", "—", "id del form al que hace scroll el botón."],
            ]}
            example={`<string-gym-planes gym="TU-SLUG"
  cta-texto="Quiero inscribirme"
  cta-form="form-contacto"></string-gym-planes>`}
          />

          <Comp
            tag="<string-gym-calendario>"
            desc="Calendario de clases con cupo en vivo."
            rows={[
              ["gym", "string", "—", "Slug del gym (requerido)."],
              ["tipo", "string", "—", "Filtra por regular/gratis/taller/privada."],
              ["api-key", "string", "—", "Para reservar desde el calendario."],
              ["cta-form", "string", "—", "Sin api-key, el botón hace scroll a este form."],
            ]}
            example={`<string-gym-calendario gym="TU-SLUG"
  api-key="sgk_xxxxx"></string-gym-calendario>`}
          />

          <Comp
            tag="<string-gym-form>"
            desc="Formulario de contacto o reserva que llega a tu CRM."
            rows={[
              ["gym", "string", "—", "Slug del gym (requerido)."],
              ["api-key", "string", "—", "Requerido (los envíos son autenticados)."],
              ["tipo", "string", '"contacto"', "contacto | clase-gratis | reserva."],
              ["sesion-id", "string", "—", "Requerido si tipo=reserva."],
              ["titulo", "string", '"Déjanos…"', "Encabezado del form."],
              ["boton", "string", '"Enviar"', "Texto del botón de envío."],
              ["exito-mensaje", "string", "—", "Mensaje tras enviar."],
            ]}
            example={`<string-gym-form gym="TU-SLUG"
  api-key="sgk_xxxxx"
  tipo="contacto"
  titulo="¿Listo para empezar?"
  boton="Quiero informes"></string-gym-form>`}
          />
        </section>

        {/* 3. Personalización CSS */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Personalización (CSS)</h2>
          <p className="text-sm text-text-secondary">
            Sobreescribe estas variables desde tu CSS. El color se auto-detecta
            del gym si no defines <code>--sg-color-primary</code>.
          </p>
          <AttrTable
            rows={[
              ["--sg-color-primary", "color", "color del gym", "Acento (botones, precios)."],
              ["--sg-color-text", "color", "#111827", "Color de texto."],
              ["--sg-color-bg", "color", "#ffffff", "Fondo de las cards."],
              ["--sg-font-family", "font", "inherit", "Hereda la fuente de tu web."],
              ["--sg-border-radius", "size", "8px", "Radio de bordes."],
              ["--sg-spacing", "size", "1rem", "Espaciado interno."],
            ]}
          />
          <Code>{`:root {
  --sg-color-primary: #e11d48;
  --sg-border-radius: 14px;
}`}</Code>
        </section>

        {/* 4. Ejemplo completo */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Landing completa</h2>
          <Code>{`<script src="${SDK_SRC}"></script>

<section id="info">
  <string-gym-info gym="body-force"></string-gym-info>
</section>

<section id="planes">
  <string-gym-planes
    gym="body-force"
    cta-texto="Quiero inscribirme"
    cta-form="form-contacto"
  ></string-gym-planes>
</section>

<section id="clases">
  <string-gym-calendario
    gym="body-force"
    api-key="sgk_xxxxx"
  ></string-gym-calendario>
</section>

<section id="form-contacto">
  <string-gym-form
    gym="body-force"
    api-key="sgk_xxxxx"
    tipo="contacto"
    titulo="¿Listo para empezar?"
    boton="Quiero informes"
  ></string-gym-form>
</section>`}</Code>
        </section>

        {/* 5. API key */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Obtener tu API key</h2>
          <p className="text-sm text-text-secondary">
            En tu panel:{" "}
            <code>app.gym.stringwebs.com/[tu-slug]/configuracion/api</code> →
            copia tu <code>sgk_…</code>. También ahí ves el log de uso. La key se
            usa solo para formularios y reservas.
          </p>
        </section>

        {/* 6. Soporte */}
        <section className="space-y-2 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">6. Soporte</h2>
          <p className="text-sm text-text-secondary">
            ¿Dudas con la integración? Escríbenos por WhatsApp:{" "}
            <a
              href={`https://wa.me/${STRING_SOPORTE_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-green hover:underline"
            >
              +52 55 4552 4847
            </a>
            .
          </p>
        </section>

        <footer className="border-t border-border pt-6 text-xs text-text-muted">
          STRING GYM SDK v1 · Ver también la{" "}
          <Link href="/api-docs" className="text-text-secondary hover:underline">
            documentación de la API
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
