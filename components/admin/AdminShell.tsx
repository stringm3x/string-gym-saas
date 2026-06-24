import { LuShield, LuArrowLeft } from "react-icons/lu";
import { logoutAdmin } from "@/app/admin/(panel)/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import type { StringAdmin } from "@/lib/types/admin";

/**
 * Shell del panel admin: sidebar + header diferenciados (acento verde
 * STRING) del app normal de gyms. Server component; el gate (sesión +
 * super admin) lo aplica el layout antes de renderizar esto. La nav
 * activa la resalta AdminNav (client, vía usePathname).
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
          <LuShield className="h-5 w-5 text-brand-green" />
          <span className="font-display text-lg uppercase tracking-wide text-text-primary">
            STRING<span className="text-brand-green">ADMIN</span>
          </span>
        </div>

        <AdminNav />

        {appDomain && (
          <a
            href={`https://${appDomain}`}
            className="flex items-center gap-1.5 border-t border-border px-5 py-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <LuArrowLeft className="h-3.5 w-3.5" /> Volver a la app
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
