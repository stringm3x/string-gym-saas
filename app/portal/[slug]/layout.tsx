import { ToastProvider } from "@/components/ui/Toast";
import { getPortalColorAcento } from "@/lib/queries/portal.queries";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Layout del Portal del Miembro: pantalla completa, sin el shell del app
// (no hay sidebar/header de staff). Los miembros no son usuarios del SaaS.
// Tematiza el portal con el color de acento del gym (mismo patrón que el
// layout del tenant: sobreescribe --color-brand-green en :root).
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const acento = await getPortalColorAcento(slug);
  const marcaCss =
    acento && HEX.test(acento)
      ? `:root{--color-brand-green:${acento};}`
      : null;

  return (
    <ToastProvider>
      {marcaCss && <style dangerouslySetInnerHTML={{ __html: marcaCss }} />}
      <div className="min-h-screen bg-bg text-text-primary">{children}</div>
    </ToastProvider>
  );
}
