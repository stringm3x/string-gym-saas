"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuUserCog, LuLogOut } from "react-icons/lu";
import { useStaff } from "@/lib/contexts/StaffContext";
import { cerrarSesionAction } from "@/app/(tenant)/[slug]/suspendida/actions";

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const ini = parts.map((w) => w[0]?.toUpperCase() ?? "").join("");
  return ini || "U";
}

export function HeaderUserMenu({ slug }: { slug: string }) {
  const { staff } = useStaff();
  const [open, setOpen] = useState(false);
  const nombre = staff?.nombre ?? "Usuario";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de cuenta"
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-bg transition-opacity hover:opacity-90"
      >
        {iniciales(nombre)}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium text-text-primary">
                {nombre}
              </p>
              <p className="text-xs capitalize text-text-secondary">
                {staff?.rol ?? ""}
              </p>
            </div>
            <Link
              href={`/${slug}/configuracion`}
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-bg"
            >
              <LuUserCog className="h-4 w-4 text-text-muted" /> Mi cuenta
            </Link>
            <form action={cerrarSesionAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-bg"
              >
                <LuLogOut className="h-4 w-4 text-text-muted" /> Cerrar sesión
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
