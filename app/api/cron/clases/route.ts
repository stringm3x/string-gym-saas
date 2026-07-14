import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runClasesCron } from "@/lib/clases/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diario que regenera las sesiones de las clases recurrentes (Bug #8),
 * manteniendo una ventana deslizante de 4 semanas. Protegido con CRON_SECRET:
 * Vercel envía `Authorization: Bearer ${CRON_SECRET}`. Si no coincide → 401.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resultado = await runClasesCron();
  return NextResponse.json({ ok: true, ...resultado });
}
