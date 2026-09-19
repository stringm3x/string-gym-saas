"use client";

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { money } from "@/lib/utils/creditos-calc";
import type { IngresoSemana } from "@/lib/queries/dashboard-charts.queries";

const AXIS = "var(--color-text-muted)";

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: IngresoSemana }[];
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="border border-border bg-surface px-3 py-2 text-xs">
      <p className="font-mono text-etiqueta uppercase text-text-muted">
        {p.payload.label}
      </p>
      <p className="mt-1 font-mono text-dato font-bold tabular-nums text-text-primary">
        {money(p.value)}
      </p>
    </div>
  );
}

export function IngresosSemanaChart({
  data,
  color,
}: {
  data: IngresoSemana[];
  color: string;
}) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  return (
    <div className="card-surface p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        Ingresos por semana
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
        {money(total)}
      </p>
      <p className="text-xs text-text-muted">Últimas 4 semanas</p>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: AXIS, fontFamily: "var(--font-ubuntu-mono)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--color-text-primary)", fillOpacity: 0.04 }}
              content={<Tip />}
            />
            <Bar dataKey="monto" radius={0} fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
