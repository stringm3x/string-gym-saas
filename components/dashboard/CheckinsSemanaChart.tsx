"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { CheckinDia } from "@/lib/queries/dashboard-charts.queries";

const AXIS = "var(--color-text-muted)";

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: CheckinDia }[];
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="border border-border bg-surface px-3 py-2 text-xs">
      <p className="font-mono text-etiqueta uppercase text-text-muted">
        {p.payload.dia}
      </p>
      <p className="mt-1 font-mono text-dato font-bold tabular-nums text-text-primary">
        {p.value} visita{p.value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function CheckinsSemanaChart({
  data,
  color,
}: {
  data: CheckinDia[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.cantidad), 1);
  return (
    <div className="card-surface p-5">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        Check-ins por día
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Cuándo viene más gente (últimos 60 días)
      </p>

      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="dia"
              tickLine={false}
              axisLine={false}
              width={34}
              tick={{ fontSize: 12, fill: AXIS, fontFamily: "var(--font-ubuntu-mono)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--color-text-primary)", fillOpacity: 0.04 }}
              content={<Tip />}
            />
            <Bar dataKey="cantidad" radius={0}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={color}
                  // Intensidad variable vía opacidad SVG: acepta hex del gym o
                  // var(--…) del tema sin depender de color-mix.
                  fillOpacity={0.35 + 0.65 * (d.cantidad / max)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
