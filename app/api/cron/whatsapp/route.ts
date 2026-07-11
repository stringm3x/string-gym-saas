import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runWhatsappCron } from "@/lib/whatsapp/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diario de WhatsApp (Vercel: "0 14 * * *" = 8am CDMX). Protegido con
 * CRON_SECRET: Vercel envía `Authorization: Bearer ${CRON_SECRET}` cuando el
 * env var está configurado. Si no coincide → 401.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resultado = await runWhatsappCron();
  return NextResponse.json({ ok: true, ...resultado });
}
