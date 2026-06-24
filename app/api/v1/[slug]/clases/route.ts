import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, corsPreflight } from "@/lib/api/response";
import { getSesionesByRango } from "@/lib/queries/clases.queries";
import { hoyYMD, sumarDiasYMD } from "@/lib/utils/clases-format";

export const runtime = "nodejs";

const TIPOS = ["regular", "gratis", "taller", "privada"];

function minutos(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiGuard(request, slug, "/clases", "GET");
  if (!g.ok) return g.response;

  const sp = request.nextUrl.searchParams;
  const hoy = hoyYMD();
  const desde = sp.get("desde") || hoy;
  const hasta = sp.get("hasta") || sumarDiasYMD(hoy, 7);
  const tipo = sp.get("tipo");

  const admin = createAdminClient();
  let sesiones = await getSesionesByRango(g.ctx.tenantId, desde, hasta, admin);

  // Solo sesiones programadas a futuro, opcionalmente filtradas por tipo.
  sesiones = sesiones.filter(
    (s) => s.estado === "programada" && s.fecha >= hoy
  );
  if (tipo && TIPOS.includes(tipo)) {
    sesiones = sesiones.filter((s) => s.clase?.tipo === tipo);
  }

  const data = sesiones.map((s) => ({
    sesion_id: s.id,
    clase_nombre: s.clase?.nombre ?? "",
    clase_tipo: s.clase?.tipo ?? "",
    clase_color: s.clase?.color ?? "#10b981",
    instructor: s.clase?.instructor ?? null,
    fecha: s.fecha,
    hora_inicio: s.hora_inicio.slice(0, 5),
    hora_fin: s.hora_fin.slice(0, 5),
    duracion_minutos: minutos(s.hora_fin) - minutos(s.hora_inicio),
    cupo_maximo: s.cupo_maximo,
    cupo_disponible: s.cupo_disponible,
    disponible: s.cupo_disponible > 0,
  }));

  g.log(200);
  return apiSuccess(data, { slug });
}
