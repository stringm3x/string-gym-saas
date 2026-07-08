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

const AXIS = "#8a958d";

interface TipProps {
  active?: boolean;
  payload?: { value: number; payload: CheckinDia }[];
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs shadow-lg">
      <p className="text-text-muted">{p.payload.dia}</p>
      <p className="font-mono font-semibold text-text-primary">
        {p.value} visita{p.value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/** Convierte un hex a rgba con la opacidad dada (para intensidad variable). */
function conAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h,
    16
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Check-ins por día
      </p>
      <p className="text-xs text-text-secondary">
        cuándo viene más gente (últimos 60 días)
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
              tick={{ fontSize: 12, fill: AXIS }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={<Tip />}
            />
            <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={conAlpha(color, 0.35 + 0.65 * (d.cantidad / max))}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
