import Link from "next/link";
import { logoutAdmin } from "@/app/admin/(panel)/actions";
import type { StringAdmin } from "@/lib/types/admin";

interface NavItem {
  href: string;
  label: string;
  ready: boolean; // false → aún no construido (Bloques 3-5)
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", ready: true },
  { href: "/admin/tenants", label: "Tenants", ready: true },
  { href: "/admin/solicitudes", label: "Solicitudes", ready: false },
  { href: "/admin/eventos", label: "Audit log", ready: false },
  { href: "/admin/cuenta", label: "Mi cuenta", ready: false },
];

/**
 * Shell del panel admin: sidebar + header diferenciados (acento rojo)
 * del app normal de gyms. Server component; el gate (sesión + super
 * admin) lo aplica el layout antes de renderizar esto.
 */
export function AdminShell({
  admin,
  children,
}: {
  admin: StringAdmin;
  children: React.ReactNode;
}) {
  const appDomain = process.env.APP_DOMAIN;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="text-lg">⚙️</span>
          <span className="font-display text-lg uppercase tracking-wide text-text-primary">
            STRING<span className="text-brand-green">ADMIN</span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg hover:text-text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className="flex cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm text-text-muted"
              >
                {item.label}
                <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                  pronto
                </span>
              </span>
            )
          )}
        </nav>

        {appDomain && (
          <a
            href={`https://${appDomain}`}
            className="border-t border-border px-5 py-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            ← Volver a la app
          </a>
        )}
      </aside>

      {/* Contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-green">
            Panel interno STRING
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary">
              {admin.nombre ?? admin.email}
            </span>
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-brand-green/40 hover:text-brand-green"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-canvas px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
