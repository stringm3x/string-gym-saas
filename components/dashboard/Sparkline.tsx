"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

/** Mini gráfica de tendencia sin ejes, para las cards de evento. */
export function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const gradId = useId().replace(/:/g, "");
  if (!data.length || data.every((v) => v === 0)) {
    return <div className="h-8 w-full" />;
  }
  const puntos = data.map((v, i) => ({ i, v }));

  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={puntos} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
