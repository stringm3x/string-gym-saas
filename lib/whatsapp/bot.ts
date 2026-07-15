/**
 * Bot de WhatsApp con IA (Fase 7.5B). Entiende lenguaje natural y ejecuta 5
 * acciones vía tool-use de Claude, llamando las queries del SaaS.
 *
 * Identifica al miembro por su teléfono (el del WhatsApp). No-op amable si
 * ANTHROPIC_API_KEY no está configurada (bot dormido).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGetMiembroPorTelefono } from "@/lib/api/data";
import {
  getSesionesByRango,
  createReserva,
  cancelarReserva,
} from "@/lib/queries/clases.queries";
import { listPlanes } from "@/lib/queries/planes.queries";
import { hoyISO, isoMasDias, formatearFechaMX } from "@/lib/utils/dates";

const MODEL = "claude-haiku-4-5"; // Haiku actual (haiku-3 ya no existe)
const MAX_ITERS = 5;

function pesos(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_clases",
    description:
      "Lista las sesiones de clases disponibles en un rango de fechas. Úsala cuando el miembro pregunte qué clases hay, horarios, o quiera reservar (primero consulta para obtener el sesion_id).",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha inicio YYYY-MM-DD (opcional, default hoy)" },
        hasta: { type: "string", description: "Fecha fin YYYY-MM-DD (opcional, default +7 días)" },
        tipo: { type: "string", description: "Filtrar por tipo: regular, gratis, taller, privada (opcional)" },
      },
    },
  },
  {
    name: "reservar_clase",
    description:
      "Reserva una sesión de clase para el miembro. Requiere el sesion_id (obtenido de consultar_clases).",
    input_schema: {
      type: "object",
      properties: { sesion_id: { type: "string" } },
      required: ["sesion_id"],
    },
  },
  {
    name: "cancelar_reserva",
    description:
      "Cancela una reserva del miembro. Requiere el reserva_id (aparece en consultar_membresia → proximas_reservas).",
    input_schema: {
      type: "object",
      properties: { reserva_id: { type: "string" } },
      required: ["reserva_id"],
    },
  },
  {
    name: "consultar_membresia",
    description:
      "Devuelve el estado de la membresía del miembro (vencimiento, días restantes, plan) y sus próximas reservas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_planes",
    description: "Lista los planes de membresía del gym con sus precios y duración.",
    input_schema: { type: "object", properties: {} },
  },
];

interface Ctx {
  admin: ReturnType<typeof createAdminClient>;
  tenantId: string;
  gymNombre: string;
  miembro: Awaited<ReturnType<typeof apiGetMiembroPorTelefono>>;
  telefono: string;
}

async function ejecutarHerramienta(
  ctx: Ctx,
  nombre: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const { admin, tenantId, miembro, telefono } = ctx;

  switch (nombre) {
    case "consultar_clases": {
      const desde = typeof input.desde === "string" ? input.desde : hoyISO();
      const hasta = typeof input.hasta === "string" ? input.hasta : isoMasDias(7);
      const tipo = typeof input.tipo === "string" ? input.tipo : null;
      const sesiones = await getSesionesByRango(tenantId, desde, hasta, admin);
      return sesiones
        .filter((s) => !tipo || s.clase?.tipo === tipo)
        .map((s) => ({
          sesion_id: s.id,
          clase: s.clase?.nombre ?? "Clase",
          tipo: s.clase?.tipo,
          fecha: s.fecha,
          hora: s.hora_inicio.slice(0, 5),
          cupo_disponible: s.cupo_disponible,
        }));
    }

    case "reservar_clase": {
      if (!miembro) return { error: "El miembro no está registrado en el gym." };
      const sesionId = String(input.sesion_id ?? "");
      const r = await createReserva(
        tenantId,
        sesionId,
        {
          miembroId: miembro.id,
          nombreVisitante: miembro.nombre,
          telefonoVisitante: telefono,
          origen: "api",
        },
        admin
      );
      if (r.error) return { ok: false, error: r.error };
      return {
        ok: true,
        en_lista_espera: r.enListaEspera,
        reserva_id: r.reserva?.id ?? null,
      };
    }

    case "cancelar_reserva": {
      if (!miembro) return { error: "El miembro no está registrado en el gym." };
      const reservaId = String(input.reserva_id ?? "");
      const r = await cancelarReserva(tenantId, reservaId, admin);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? "No se encontró la reserva." };
    }

    case "consultar_membresia": {
      if (!miembro) return { error: "El miembro no está registrado en el gym." };
      return { membresia: miembro.membresia, proximas_reservas: miembro.proximas_reservas };
    }

    case "consultar_planes": {
      const planes = await listPlanes(tenantId, { soloActivos: true }, admin);
      return planes.map((p) => ({
        nombre: p.nombre,
        precio: pesos(p.precio),
        dias_duracion: p.dias_duracion,
      }));
    }

    default:
      return { error: "Herramienta desconocida." };
  }
}

/**
 * Procesa un mensaje del miembro en lenguaje natural y devuelve la respuesta en
 * español. Nunca lanza: ante cualquier fallo devuelve un mensaje de contacto.
 */
export async function procesarMensajeBot(
  mensaje: string,
  telefono: string,
  gymSlug: string
): Promise<string> {
  const admin = createAdminClient();

  // Gym por slug (para el nombre y el teléfono de contacto del fallback).
  const { data: gym } = await admin
    .from("gyms")
    .select("id, nombre, telefono")
    .eq("slug", gymSlug)
    .maybeSingle();

  const gymTelefono = (gym?.telefono as string | null) ?? null;
  const fallback = gymTelefono
    ? `Hola, para ayudarte mejor, escríbenos al ${gymTelefono}.`
    : "Hola, en un momento te contactamos para ayudarte.";

  // No-op amable si no hay IA configurada (bot dormido) o no existe el gym.
  if (!process.env.ANTHROPIC_API_KEY || !gym) return fallback;

  try {
    const miembro = await apiGetMiembroPorTelefono(gym.id as string, telefono, admin);

    const ctx: Ctx = {
      admin,
      tenantId: gym.id as string,
      gymNombre: gym.nombre as string,
      miembro,
      telefono,
    };

    const contextoMiembro = miembro
      ? `El miembro se llama ${miembro.nombre}. Su membresía está "${miembro.membresia.estado}"${
          miembro.membresia.fecha_vencimiento
            ? `, vence el ${miembro.membresia.fecha_vencimiento}`
            : ""
        }.`
      : "El teléfono no corresponde a un miembro registrado. Puede consultar clases y planes, pero para reservar o ver su membresía debe pedirle a su gym que lo registre.";

    const system = `Eres el asistente de WhatsApp del gimnasio "${gym.nombre}". Hoy es ${formatearFechaMX(
      new Date()
    )}. Respondes en español, con calidez y de forma breve (es WhatsApp).

${contextoMiembro}

Puedes: consultar clases disponibles, reservar una clase, cancelar una reserva, consultar la membresía del miembro y consultar los planes/precios. Usa las herramientas para obtener datos reales antes de responder; nunca inventes horarios, precios ni disponibilidad. Para reservar, primero consulta las clases y elige la sesión que pide el miembro. Confirma cada acción con un mensaje claro.`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: mensaje }];
    const client = new Anthropic();

    for (let i = 0; i < MAX_ITERS; i++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: TOOLS,
        messages,
      });

      if (resp.stop_reason !== "tool_use") {
        const texto = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return texto || fallback;
      }

      messages.push({ role: "assistant", content: resp.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const salida = await ejecutarHerramienta(
            ctx,
            block.name,
            (block.input ?? {}) as Record<string, unknown>
          );
          resultados.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(salida),
          });
        }
      }
      messages.push({ role: "user", content: resultados });
    }

    return fallback; // se agotó el loop sin respuesta final
  } catch (err) {
    console.error("[bot] procesarMensajeBot:", err);
    return fallback;
  }
}
