"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GymAddon } from "@/lib/queries/addons.queries";

const AddonsContext = createContext<GymAddon[]>([]);

export function AddonsProvider({
  children,
  addons,
}: {
  children: ReactNode;
  addons: GymAddon[];
}) {
  return (
    <AddonsContext.Provider value={addons}>{children}</AddonsContext.Provider>
  );
}

/** Check síncrono contra los add-ons del contexto. */
export function useHasAddon(addonId: string): boolean {
  const addons = useContext(AddonsContext);
  return addons.some((a) => a.addon_id === addonId && a.estado === "activo");
}

/** Acceso al listado completo de add-ons del gym desde el contexto. */
export function useGymAddons(): GymAddon[] {
  return useContext(AddonsContext);
}
