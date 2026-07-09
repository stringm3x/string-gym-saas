"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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

  return (
    <div className="fixed inset-0 flex flex-col items-center bg-bg px-6 py-8">
      {/* Logo / nombre */}
      <div className="flex flex-col items-center gap-2">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={gymNombre}
            width={300}
            height={96}
            unoptimized
            priority
            className="h-16 w-auto max-w-[280px] object-contain"
          />
        ) : (
          <span className="font-display text-3xl uppercase tracking-wide text-text-primary">
            {gymNombre}
          </span>
        )}
      </div>

      {/* Tabs (solo con feature de autoservicio) */}
      {canAutoservicio && (
        <div className="mt-6 flex gap-2 rounded-2xl border border-border bg-surface p-1.5">
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
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-semibold transition-colors " +
                  (activo
                    ? "bg-brand-green text-bg"
                    : "text-text-secondary hover:text-text-primary")
                }
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido de la tab activa */}
      <div className="flex w-full min-h-0 flex-1 items-center justify-center">
        {tab === "entrada" && <KioscoEntrada slug={slug} />}
        {tab === "comprar" && canAutoservicio && <KioscoComprar slug={slug} />}
        {tab === "membresia" && canAutoservicio && (
          <KioscoMembresia slug={slug} />
        )}
      </div>

      {/* Acceso discreto a administración */}
      <Link
        href={`/${slug}/checkins`}
        className="text-xs text-text-muted hover:text-text-secondary"
      >
        Administración
      </Link>
    </div>
  );
}
