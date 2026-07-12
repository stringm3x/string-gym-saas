import { NextResponse } from "next/server";

/** CORS abierto: la API pública se consume desde webs externas de los gyms. */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "SESION_NO_ENCONTRADA"
  | "SESION_CANCELADA"
  | "RESERVA_NO_ENCONTRADA"
  | "MIEMBRO_NO_ENCONTRADO"
  | "FEATURE_NO_DISPONIBLE"
  | "INTERNAL_ERROR";

function meta(slug?: string) {
  return {
    timestamp: new Date().toISOString(),
    ...(slug ? { slug } : {}),
  };
}

export function apiSuccess(
  data: unknown,
  opts: { slug?: string; status?: number } = {}
): NextResponse {
  return NextResponse.json(
    { data, meta: meta(opts.slug) },
    { status: opts.status ?? 200, headers: CORS_HEADERS }
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  slug?: string
): NextResponse {
  return NextResponse.json(
    { error: { code, message }, meta: meta(slug) },
    { status, headers: CORS_HEADERS }
  );
}

/** Respuesta a preflight CORS (OPTIONS). */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
