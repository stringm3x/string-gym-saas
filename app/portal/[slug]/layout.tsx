import { ToastProvider } from "@/components/ui/Toast";

// Layout del Portal del Miembro: pantalla completa, sin el shell del app
// (no hay sidebar/header de staff). Los miembros no son usuarios del SaaS.
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg text-text-primary">{children}</div>
    </ToastProvider>
  );
}
