"use client";

import { useState } from "react";
import { LuPackagePlus } from "react-icons/lu";
import { AddonCard } from "./AddonCard";
import { AddonDetailModal } from "./AddonDetailModal";
import { ADDONS_CATALOG, type AddonDefinition } from "@/lib/addons";
import type { Plan } from "@/lib/features";
import type { GymAddon } from "@/lib/queries/addons.queries";

interface AddonsManagerProps {
  addonsActivos: GymAddon[];
  planActual: Plan;
  gymNombre: string;
}

export function AddonsManager({
  addonsActivos,
  planActual,
  gymNombre,
}: AddonsManagerProps) {
  const [detail, setDetail] = useState<AddonDefinition | null>(null);
  const [open, setOpen] = useState(false);

  const activosMap = new Map(
    addonsActivos
      .filter((a) => a.estado === "activo")
      .map((a) => [a.addon_id, a])
  );

  const activos = ADDONS_CATALOG.filter((a) => activosMap.has(a.id));
  const disponibles = ADDONS_CATALOG.filter(
    (a) => !activosMap.has(a.id) && a.estado === "disponible"
  );
  const proximamente = ADDONS_CATALOG.filter(
    (a) =>
      !activosMap.has(a.id) &&
      (a.estado === "proximamente" || a.estado === "en_desarrollo")
  );

  function openDetail(addon: AddonDefinition) {
    setDetail(addon);
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      {activos.length > 0 && (
        <Section titulo="Tus add-ons activos">
          {activos.map((a) => (
            <AddonCard
              key={a.id}
              addon={a}
              gymAddon={activosMap.get(a.id)}
              gymNombre={gymNombre}
              onOpenDetail={() => openDetail(a)}
            />
          ))}
        </Section>
      )}

      {disponibles.length > 0 && (
        <Section titulo="Disponibles">
          {disponibles.map((a) => (
            <AddonCard
              key={a.id}
              addon={a}
              gymNombre={gymNombre}
              onOpenDetail={() => openDetail(a)}
            />
          ))}
        </Section>
      )}

      {proximamente.length > 0 && (
        <Section titulo="Próximamente">
          {proximamente.map((a) => (
            <AddonCard
              key={a.id}
              addon={a}
              gymNombre={gymNombre}
              onOpenDetail={() => openDetail(a)}
            />
          ))}
        </Section>
      )}

      {activos.length === 0 &&
        disponibles.length === 0 &&
        proximamente.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <LuPackagePlus className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-secondary">
              No hay add-ons en el catálogo todavía.
            </p>
          </div>
        )}

      <AddonDetailModal
        addon={detail}
        gymAddon={detail ? activosMap.get(detail.id) : undefined}
        planActual={planActual}
        gymNombre={gymNombre}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

function Section({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {titulo}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
