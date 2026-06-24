"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SELECT_CLASS =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none";

export function TenantsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`/admin/tenants?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ search });
        }}
        className="flex-1 min-w-[220px]"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, slug o email…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
      </form>

      <select
        value={params.get("estado") ?? ""}
        onChange={(e) => apply({ estado: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">Estado: todos</option>
        <option value="activo">Activo</option>
        <option value="prueba">Prueba</option>
        <option value="suspendido">Suspendido</option>
        <option value="cancelado">Cancelado</option>
      </select>

      <select
        value={params.get("plan") ?? ""}
        onChange={(e) => apply({ plan: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">Plan: todos</option>
        <option value="basico">Básico</option>
        <option value="pro">Pro</option>
        <option value="escala">Escala</option>
      </select>

      <select
        value={params.get("antiguedad") ?? ""}
        onChange={(e) => apply({ antiguedad: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">Antigüedad: todas</option>
        <option value="mes">Último mes</option>
        <option value="trimestre">Últimos 3 meses</option>
        <option value="antiguos">Más antiguos</option>
      </select>

      <select
        value={params.get("orden") ?? "recientes"}
        onChange={(e) => apply({ orden: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="recientes">Más recientes</option>
        <option value="nombre">Nombre (A-Z)</option>
        <option value="mrr">MRR (mayor)</option>
      </select>
    </div>
  );
}
