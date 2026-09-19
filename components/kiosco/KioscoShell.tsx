"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LuScanLine, LuShoppingCart, LuCreditCard } from "react-icons/lu";
import { KioscoEntrada } from "./KioscoEntrada";
import { KioscoComprar } from "./KioscoComprar";
import { KioscoMembresia } from "./KioscoMembresia";

type Tab = "entrada" | "comprar" | "membresia";

const TABS: { id: Tab; label: string; icon: typeof LuScanLine }[] = [
  { id: "entrada", label: "Entrada", icon: LuScanLine },
  { id: "comprar", label: "Comprar", icon: LuShoppingCart },
  { id: "membresia", label: "Pagar membresía", icon: LuCreditCard },
];

function useReloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!ahora) return "";
  const fecha = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(ahora);
  const hora = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ahora);
  return `${fecha} · ${hora}`;
}

/**
 * Kiosco: pantalla completa, se ve a distancia. Manda el color del gimnasio
 * (el layout ya sobreescribe --color-brand-green). Áreas táctiles grandes.
 */
export function KioscoShell({
  slug,
  gymNombre,
  logoUrl,
  canAutoservicio,
}: {
  slug: string;
  gymNombre: string;
  logoUrl: string | null;
  canAutoservicio: boolean;
}) {
  const [tab, setTab] = useState<Tab>("entrada");
  const tabs = canAutoservicio ? TABS : TABS.slice(0, 1);
  const reloj = useReloj();
  const inicial = (gymNombre.trim()[0] ?? "G").toUpperCase();

  return (
    <div className="fixed inset-0 flex flex-col bg-bg px-6 py-6 sm:px-12 sm:py-10">
      {/* Cabecera: identidad del gimnasio + fecha y hora */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={gymNombre}
              width={300}
              height={96}
              unoptimized
              priority
              className="h-14 w-auto max-w-[260px] object-contain"
            />
          ) : (
            <>
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center bg-brand-green font-display text-[32px] leading-none text-on-brand"
              >
                {inicial}
              </span>
              <span className="text-2xl font-semibold text-text-primary">
                {gymNombre}
              </span>
            </>
          )}
        </div>
        <span
          className="font-mono text-[15px] uppercase leading-5 tracking-[0.16em] text-text-secondary"
          suppressHydrationWarning
        >
          {reloj}
        </span>
      </header>

      {/* Tabs (solo con autoservicio): control segmentado, 56px de alto */}
      {canAutoservicio && (
        <div className="mt-8 flex self-center border border-border">
          {tabs.map((t) => {
            const activo = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={activo ? "page" : undefined}
                className={
                  "inline-flex h-14 items-center gap-3 px-6 text-lg font-semibold transition-colors " +
                  (activo
                    ? "bg-brand-green text-on-brand"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary")
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido de la tab activa */}
      <main className="flex min-h-0 flex-1 items-center justify-center py-8">
        {tab === "entrada" && <KioscoEntrada slug={slug} />}
        {tab === "comprar" && canAutoservicio && <KioscoComprar slug={slug} />}
        {tab === "membresia" && canAutoservicio && (
          <KioscoMembresia slug={slug} />
        )}
      </main>

      {/* Pie: acceso discreto a administración + firma */}
      <footer className="flex items-center justify-between border-t border-border pt-6">
        <Link
          href={`/${slug}/checkins`}
          className="inline-flex h-12 items-center border border-border px-5 text-base text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
        >
          Administración
        </Link>
        <span className="font-mono text-etiqueta uppercase text-text-muted">
          STRING GYM
        </span>
      </footer>
    </div>
  );
}
