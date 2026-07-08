"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { LuTrendingUp, LuTrendingDown } from "react-icons/lu";
import type { Retencion } from "@/lib/queries/dashboard-charts.queries";

export function RetencionCard({ data }: { data: Retencion }) {
  const color = data.sube ? "#4fe05a" : "#ff5c5c";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Retención del mes
      </p>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-4xl font-bold tabular-nums text-text-primary">
            {data.pct}%
          </p>
          <p
            className="mt-1 flex items-center gap-1 text-xs font-medium"
            style={{ color }}
          >
            {data.sube ? (
              <LuTrendingUp className="h-3.5 w-3.5" />
            ) : (
              <LuTrendingDown className="h-3.5 w-3.5" />
            )}
            {data.renovacionesMes} renovaci
            {data.renovacionesMes === 1 ? "ón" : "ones"} de {data.activos}{" "}
            activos
          </p>
        </div>

        <div className="h-14 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.tendencia}
              margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            >
              <YAxis hide domain={[0, "dataMax + 1"]} />
              <Line
                type="monotone"
                dataKey="renovaciones"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 2, fill: color }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-secondary">
        Tendencia:{" "}
        {data.tendencia.map((t) => `${t.mes} ${t.renovaciones}`).join(" · ")}
      </p>
    </div>
  );
}
