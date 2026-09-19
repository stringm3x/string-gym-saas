"use client";

import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MembresiasBreakdown } from "@/lib/queries/dashboard-charts.queries";

const COLORS = {
  activos: "var(--color-brand-green)",
  porVencer: "var(--color-warning)",
  vencidos: "var(--color-danger)",
};
/** Anillo cuando no hay socios que graficar. */
const COLOR_VACIO = "var(--color-border)";

export function MembresiasDonut({
  data,
  slug,
}: {
  data: MembresiasBreakdown;
  slug: string;
}) {
  const router = useRouter();

  const segments = [
    { key: "activos", label: "Activos", value: data.activos, color: COLORS.activos, filtro: "activos" },
    { key: "porVencer", label: "Por vencer", value: data.porVencer, color: COLORS.porVencer, filtro: "por_vencer" },
    { key: "vencidos", label: "Vencidos", value: data.vencidos, color: COLORS.vencidos, filtro: "inactivos" },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  const conDatos = segments.filter((s) => s.value > 0);

  function ir(filtro: string) {
    router.push(`/${slug}/miembros?filter=${filtro}`);
  }

  return (
    <div className="card-surface p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        Membresías
      </p>

      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={conDatos.length ? conDatos : [{ label: "—", value: 1, color: COLOR_VACIO }]}
                dataKey="value"
                nameKey="label"
                innerRadius={46}
                outerRadius={68}
                paddingAngle={conDatos.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
                onClick={(_, i) => conDatos[i] && ir(conDatos[i].filtro)}
              >
                {(conDatos.length ? conDatos : [{ color: COLOR_VACIO }]).map(
                  (s, i) => (
                    <Cell
                      key={i}
                      fill={s.color}
                      className={conDatos.length ? "cursor-pointer" : ""}
                    />
                  )
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
              {total}
            </span>
            <span className="font-mono text-xs uppercase text-text-muted">
              miembros
            </span>
          </div>
        </div>

        <ul className="flex-1">
          {segments.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => ir(s.filtro)}
                  className="flex h-11 w-full items-center justify-between gap-2 px-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="flex items-center gap-2 font-mono text-etiqueta uppercase text-text-secondary">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </span>
                  <span className="font-mono text-dato tabular-nums text-text-primary">
                    {s.value}{" "}
                    <span className="text-xs text-text-muted">({pct}%)</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
