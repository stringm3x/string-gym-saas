import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { solicitudSchema } from "@/lib/validations/solicitud.schema";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { createSolicitud } from "@/lib/queries/solicitudes.queries";
import {
  sendAlertaSolicitud,
  sendBienvenidaSolicitud,
} from "@/lib/email/solicitudes";

export const runtime = "nodejs";

// La web pública (stringwebs.com) es otro origen → CORS abierto para el POST.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const parsed = solicitudSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      400
    );
  }
  const v = parsed.data;

  // Anti-spam: Turnstile.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const okTurnstile = await verifyTurnstile(v.turnstile_token, ip);
  if (!okTurnstile) {
    return json({ error: "Verificación de seguridad fallida." }, 403);
  }

  const created = await createSolicitud({
    nombre: v.nombre,
    email: v.email,
    telefono: v.telefono || undefined,
    nombre_gym: v.nombre_gym || undefined,
    plan_interes: v.plan_interes,
    ciudad: v.ciudad || undefined,
    miembros_aprox: v.miembros_aprox,
    como_entero: v.como_entero || undefined,
    notas: v.notas || undefined,
  });
  if (!created.ok) {
    return json({ error: "No se pudo registrar la solicitud." }, 500);
  }

  // Emails (no bloquean la respuesta ante fallo).
  const data = {
    nombre: v.nombre,
    email: v.email,
    telefono: v.telefono,
    nombre_gym: v.nombre_gym,
    plan_interes: v.plan_interes,
    ciudad: v.ciudad,
    miembros_aprox: v.miembros_aprox,
    como_entero: v.como_entero,
    notas: v.notas,
  };
  await Promise.allSettled([
    sendAlertaSolicitud(data),
    sendBienvenidaSolicitud(data),
  ]);

  return json({ success: true }, 200);
}
