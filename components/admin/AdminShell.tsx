import { LuArrowLeft } from "react-icons/lu";
import { logoutAdmin } from "@/app/admin/(panel)/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import type { StringAdmin } from "@/lib/types/admin";

/**
 * Shell del panel interno de STRING: mismo lenguaje que el panel del gym
 * (sidebar en fondo-elevado, ítems a sangre, verde STRING). Server
 * component; el gate (sesión + super admin) lo aplica el layout antes de
 * renderizar esto. La nav activa la resalta AdminNav (client, usePathname).
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
      <aside className="flex w-60 flex-col border-r border-border bg-surface py-6">
        <div className="mb-4 flex items-center gap-3 px-5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center bg-brand-green font-display text-lg leading-none text-on-brand"
          >
            S
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5 text-text-primary">
              STRING Admin
            </p>
            <p className="font-mono text-etiqueta uppercase text-text-muted">
              Panel interno
            </p>
          </div>
        </div>

        <AdminNav />

        {appDomain && (
          <a
            href={`https://${appDomain}`}
            className="flex h-11 items-center gap-2 border-t border-border px-5 text-sm text-text-secondary transition-colors hover:bg-surface-hover/60 hover:text-text-primary"
          >
            <LuArrowLeft className="h-4 w-4" /> Volver a la app
          </a>
        )}
      </aside>

      {/* Contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border px-8">
          <span className="font-mono text-etiqueta uppercase text-text-muted">
            Solo administradores de STRING
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              {admin.nombre ?? admin.email}
            </span>
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="h-9 border border-border px-3 text-sm text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
