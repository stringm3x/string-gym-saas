import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/Toast";
import { Grano } from "@/components/arte/Grano";
import { hasFeature } from "@/lib/features";
import { gymOperativo } from "@/lib/utils/gym-operativo";
import {
  getPortalColorAcento,
  getPortalGym,
} from "@/lib/queries/portal.queries";

const HEX = /^#[0-9a-fA-F]{6}$/;
const TAGLINE = "Tu membresía, clases y recibos";

/**
 * Bloque 10 sueltos (privacidad): un solo generateMetadata cubre todo el
 * portal (login, home, recibos, clases, renovar) — la tarjeta de
 * WhatsApp/Slack para cualquiera de esas rutas mostraba la marca de
 * STRING, no la del gimnasio. Solo nombre y logo del gym; nada del socio
 * (aquí no hay socio identificado todavía en la mayoría de estas rutas).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gym = await getPortalGym(slug);
  const gymNombre = gym?.nombre ?? "STRING GYM";
  const logoUrl = gym?.logo_url ?? undefined;

  return {
    title: `${gymNombre} — ${TAGLINE}`,
    description: TAGLINE,
    openGraph: {
      title: gymNombre,
      description: TAGLINE,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

// Layout del Portal del Miembro: pantalla completa, sin el shell del app
// (no hay sidebar/header de staff). Los miembros no son usuarios del SaaS.
// Tematiza el portal con el color de acento del gym (sobreescribe
// --color-brand-green en :root) — color_gimnasio está en todos los planes,
// incluido Starter (plan/02-gating): el acento hacia el socio no es Pro.
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [gym, acento] = await Promise.all([
    getPortalGym(slug),
    getPortalColorAcento(slug),
  ]);
  const aplicaColor = !!gym && hasFeature(gym.plan, "color_gimnasio");
  const marcaCss =
    aplicaColor && acento && HEX.test(acento)
      ? `:root{--color-brand-green:${acento};}`
      : null;

  // Bloque 10: gatea TODA la superficie del portal, login incluido — el
  // login pide el código por OTP vía anonAction (sin portalAction de por
  // medio), así que el gate de portalAction no lo cubre. Puesto acá, en el
  // layout, no hay hueco: nadie llega ni siquiera a la pantalla de login de
  // un gimnasio no operativo. Mensaje neutral a propósito, igual que kiosco.
  if (gym && !gymOperativo(gym)) {
    return (
      <ToastProvider>
        <Grano opacidad={0.15} />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-text-primary">
          <h1 className="font-display text-3xl uppercase">{gym.nombre}</h1>
          <p className="max-w-md text-lg text-text-secondary">
            Este gimnasio no está disponible en este momento. Consulta
            directamente con el gimnasio.
          </p>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {marcaCss && <style dangerouslySetInnerHTML={{ __html: marcaCss }} />}
      <Grano opacidad={0.15} />
      <div className="min-h-screen bg-bg text-text-primary">{children}</div>
    </ToastProvider>
  );
}
