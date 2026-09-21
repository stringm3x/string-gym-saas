"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { kioscoAction, type Denegado } from "@/lib/authz";
import {
  createCheckin,
  visitasAgotadas,
  checkinReciente,
} from "@/lib/queries/checkins.queries";
import { congelacionActiva } from "@/lib/queries/miembro-eventos.queries";
import { getDeudaVencida } from "@/lib/queries/creditos.queries";
import {
  getProductosKiosco,
  getPlanesMembresiaKiosco,
  crearCodigoAutorizacion,
  type KioscoProducto,
  type KioscoPlan,
} from "@/lib/queries/kiosco.queries";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";
import { hoyISO } from "@/lib/utils/dates";

// Toda acción del kiosco tiene firma pública (slug, token, ...args): el
// socio sale del qr_token (ctx.miembro) y no existe un miembroId del
// cliente que revalidar. Ver docs/autorizacion-acciones.md.

export type KioscoError =
  | "QR_NO_ENCONTRADO"
  | "MIEMBRO_ARCHIVADO"
  | "MEMBRESIA_VENCIDA"
  | "MEMBRESIA_CONGELADA"
  | "SIN_VISITAS"
  | "CHECKIN_RECIENTE"
  | "NO_DISPONIBLE"
  | "ERROR";

export type KioscoResult =
  | {
      success: true;
      nombre: string;
      plan: string | null;
      miembroId: string;
      /** true si el miembro no tiene teléfono usable (para pedirlo). */
      sinContacto: boolean;
      /** true si se dejó pasar con membresía vencida/sin registrar (política "solo avisar"). */
      avisoVencido: boolean;
      fechaVencimiento: string | null;
      /** Solo aviso, nunca bloquea (bloque 08): cuotas vencidas de un plan a plazos. */
      deudaVencida: { monto: number; cuotas: number } | null;
    }
  | { success: false; error: KioscoError; nombre?: string };

const NO_DISPONIBLE = "El autoservicio no está disponible en este gimnasio.";

/** Denegación en la forma `{ ok, error }` con texto para el socio, no para el staff. */
function denegar(d: Denegado): { ok: false; error: string } {
  return { ok: false, error: d.code === "SIN_PLAN" ? NO_DISPONIBLE : d.error };
}

/** Teléfono ausente o placeholder → conviene pedirlo. */
function sinTelefono(tel: string | null): boolean {
  const t = (tel ?? "").replace(/\D/g, "");
  return t.length === 0 || t === "0000000000";
}

/**
 * Self check-in público: el miembro escanea su propio QR, sin staff ni
 * sesión. Registra el check-in si la membresía está vigente.
 */
export const checkInKioscoAction = kioscoAction(
  "kiosco.checkin",
  {
    onDenied: (d): KioscoResult => ({
      success: false,
      error: d.code === "SIN_PLAN" ? "NO_DISPONIBLE" : "QR_NO_ENCONTRADO",
    }),
  },
  async ({ gym, miembro, admin }): Promise<KioscoResult> => {
    if (miembro.archivado) {
      return { success: false, error: "MIEMBRO_ARCHIVADO", nombre: miembro.nombre };
    }
    if (await congelacionActiva(gym.id, miembro.id, admin)) {
      return { success: false, error: "MEMBRESIA_CONGELADA", nombre: miembro.nombre };
    }
    if (await visitasAgotadas(gym.id, miembro.id, admin)) {
      return { success: false, error: "SIN_VISITAS", nombre: miembro.nombre };
    }
    // Mismo QR sostenido frente al lector o doble tap: el lock del cliente se
    // libera a los 3s, esto cubre el hueco del lado del servidor.
    if (await checkinReciente(gym.id, miembro.id, admin)) {
      return { success: false, error: "CHECKIN_RECIENTE", nombre: miembro.nombre };
    }
    // sin_membresia sigue la misma política que vencido: no hay fecha =
    // nunca hubo vigencia que vencer, tampoco hay nada que "avisar y dejar
    // pasar".
    const vencidoOSinMembresia =
      !miembro.fecha_vencimiento || miembro.fecha_vencimiento < hoyISO();
    if (vencidoOSinMembresia && gym.checkin_bloquea_vencidos !== false) {
      return { success: false, error: "MEMBRESIA_VENCIDA", nombre: miembro.nombre };
    }

    const res = await createCheckin(gym.id, miembro.id, admin);
    if (!res.ok) {
      return { success: false, error: "ERROR", nombre: miembro.nombre };
    }

    // Nombre del plan (best-effort) para el saludo.
    let plan: string | null = null;
    if (miembro.plan_id) {
      const { data: p } = await admin
        .from("planes_membresia")
        .select("nombre")
        .eq("id", miembro.plan_id)
        .maybeSingle();
      plan = p?.nombre ?? null;
    }

    return {
      success: true,
      nombre: miembro.nombre,
      plan,
      miembroId: miembro.id,
      sinContacto: sinTelefono(miembro.telefono),
      avisoVencido: vencidoOSinMembresia,
      fechaVencimiento: miembro.fecha_vencimiento ?? null,
      deudaVencida: await getDeudaVencida(gym.id, miembro.id, admin),
    };
  }
);

// ============================================================
// AUTOSERVICIO — COMPRAS (Bloque 2)
// ============================================================

export type KioscoMetodo = "efectivo" | "transferencia" | "mercadopago";
const METODOS: KioscoMetodo[] = ["efectivo", "transferencia", "mercadopago"];

export type IdentificarResult =
  | {
      ok: true;
      miembro: { id: string; nombre: string };
      productos: KioscoProducto[];
      mpDisponible: boolean;
    }
  | { ok: false; error: string };

export type CodigoResult =
  | { ok: true; codigo: string; expiraAt: string }
  | { ok: false; error: string };

/**
 * Identifica al miembro por su QR (sin registrar entrada) y devuelve el
 * catálogo de productos disponibles para comprar en el kiosco.
 */
export const identificarMiembroKioscoAction = kioscoAction(
  "kiosco.identificar_compra",
  { onDenied: denegar },
  async ({ gym, miembro }): Promise<IdentificarResult> => {
    if (miembro.archivado) return { ok: false, error: "Cuenta inactiva." };

    const productos = await getProductosKiosco(gym.id);

    return {
      ok: true,
      miembro: { id: miembro.id, nombre: miembro.nombre },
      productos,
      mpDisponible: !!gym.mp_access_token,
    };
  }
);

/**
 * Genera un código de autorización para una compra. El total y el stock se
 * recalculan en el servidor; el staff cobra y descuenta stock al autorizar.
 */
export const crearCodigoCompraAction = kioscoAction(
  "kiosco.codigo_compra",
  { onDenied: denegar },
  async (
    { gym, miembro },
    items: { producto_id: string; cantidad: number }[],
    metodo: KioscoMetodo
  ): Promise<CodigoResult> => {
    if (!METODOS.includes(metodo)) {
      return { ok: false, error: "Método de pago inválido." };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: "Selecciona al menos un producto." };
    }

    const productos = await getProductosKiosco(gym.id);
    const porId = new Map(productos.map((p) => [p.id, p]));

    const lineas: {
      producto_id: string;
      nombre: string;
      cantidad: number;
      precio: number;
    }[] = [];
    let total = 0;

    for (const it of items) {
      const p = porId.get(it.producto_id);
      if (!p) return { ok: false, error: "Un producto ya no está disponible." };
      const cantidad = Math.floor(it.cantidad);
      if (!Number.isFinite(cantidad) || cantidad < 1) {
        return { ok: false, error: "Cantidad inválida." };
      }
      if (cantidad > p.stock) {
        return { ok: false, error: `Sin stock suficiente de ${p.nombre}.` };
      }
      lineas.push({
        producto_id: p.id,
        nombre: p.nombre,
        cantidad,
        precio: p.precio,
      });
      total += p.precio * cantidad;
    }

    if (total <= 0) return { ok: false, error: "El total debe ser mayor a 0." };

    const r = await crearCodigoAutorizacion({
      tenantId: gym.id,
      tipo: "compra",
      payload: { metodo, total, items: lineas },
      miembroId: miembro.id,
    });
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo generar el código." };

    return { ok: true, codigo: r.codigo!, expiraAt: r.expiraAt! };
  }
);

// ============================================================
// AUTOSERVICIO — MEMBRESÍA (Bloque 3)
// ============================================================

export type IdentificarMembresiaResult =
  | {
      ok: true;
      miembro: { id: string; nombre: string; fecha_vencimiento: string | null };
      planes: KioscoPlan[];
      mpDisponible: boolean;
    }
  | { ok: false; error: string };

export type RenovarMpResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

/**
 * Identifica al miembro por QR y devuelve su vencimiento + planes activos
 * para renovar en el kiosco.
 */
export const identificarMembresiaKioscoAction = kioscoAction(
  "kiosco.identificar_membresia",
  { onDenied: denegar },
  async ({ gym, miembro }): Promise<IdentificarMembresiaResult> => {
    if (miembro.archivado) return { ok: false, error: "Cuenta inactiva." };

    const planes = await getPlanesMembresiaKiosco(gym.id);

    return {
      ok: true,
      miembro: {
        id: miembro.id,
        nombre: miembro.nombre,
        fecha_vencimiento: miembro.fecha_vencimiento ?? null,
      },
      planes,
      mpDisponible: !!gym.mp_access_token,
    };
  }
);

/** Valida que el plan exista y esté activo en el gym. */
async function planValido(admin: SupabaseClient, gymId: string, planId: string) {
  const { data } = await admin
    .from("planes_membresia")
    .select("id, nombre, precio, activo")
    .eq("tenant_id", gymId)
    .eq("id", planId)
    .maybeSingle();
  if (!data || !data.activo) return null;
  return { id: data.id as string, nombre: data.nombre as string, precio: Number(data.precio) };
}

/**
 * Genera un código de autorización para renovar membresía en efectivo o
 * transferencia. El staff cobra y extiende el vencimiento al autorizar.
 */
export const crearCodigoMembresiaAction = kioscoAction(
  "kiosco.codigo_membresia",
  { onDenied: denegar },
  async (
    { gym, miembro, admin },
    planId: string,
    metodo: "efectivo" | "transferencia"
  ): Promise<CodigoResult> => {
    if (metodo !== "efectivo" && metodo !== "transferencia") {
      return { ok: false, error: "Método de pago inválido." };
    }

    const plan = await planValido(admin, gym.id, planId);
    if (!plan) return { ok: false, error: "Ese plan no está disponible." };

    const r = await crearCodigoAutorizacion({
      tenantId: gym.id,
      tipo: "membresia",
      payload: {
        planId: plan.id,
        planNombre: plan.nombre,
        monto: plan.precio,
        metodo,
        miembroId: miembro.id,
      },
      miembroId: miembro.id,
    });
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo generar el código." };

    return { ok: true, codigo: r.codigo!, expiraAt: r.expiraAt! };
  }
);

/**
 * Inicia la renovación con MercadoPago desde el kiosco. Crea `pagos_externos`
 * (pending) con miembroId+planId; el webhook confirma el pago y extiende el
 * vencimiento automáticamente — por eso es la acción de mayor impacto del
 * kiosco: el socio sale del token, nunca del cliente.
 */
export const renovarMembresiaMpKioscoAction = kioscoAction(
  "kiosco.renovar_mp",
  { onDenied: denegar },
  async ({ gym, miembro, admin, has }, planId: string): Promise<RenovarMpResult> => {
    if (!has("kiosco_autoservicio")) return { ok: false, error: NO_DISPONIBLE };

    // getMiembroByQrToken no trae email (lo usa el checkout de MP); una
    // segunda lectura acotada, ya con la identidad resuelta por el token.
    const { data: datos } = await admin
      .from("miembros")
      .select("email")
      .eq("tenant_id", gym.id)
      .eq("id", miembro.id)
      .maybeSingle();

    const plan = await planValido(admin, gym.id, planId);
    if (!plan) return { ok: false, error: "Ese plan no está disponible." };

    const refId = randomUUID();
    const { error: insErr } = await admin.from("pagos_externos").insert({
      tenant_id: gym.id,
      proveedor: "mercadopago",
      external_id: refId,
      status: "pending",
      monto: plan.precio,
      metadata: { descripcion: plan.nombre, miembroId: miembro.id, planId: plan.id },
    });
    if (insErr) return { ok: false, error: "No se pudo iniciar el pago." };

    const domain = process.env.APP_DOMAIN ?? "app.gym.stringwebs.com";
    const kioscoUrl = `https://${domain}/kiosco/${gym.slug}`;

    const pref = await createCheckoutPreference(gym.id, {
      titulo: plan.nombre,
      monto: plan.precio,
      successUrl: kioscoUrl,
      failureUrl: kioscoUrl,
      pendingUrl: kioscoUrl,
      externalReference: refId,
      payerEmail: (datos?.email as string | null) || undefined,
    });

    if (!pref.ok) {
      await admin
        .from("pagos_externos")
        .delete()
        .eq("tenant_id", gym.id)
        .eq("external_id", refId);
      return {
        ok: false,
        error:
          pref.error === "MP_NO_CONECTADO"
            ? "El gimnasio no tiene pagos en línea configurados."
            : pref.error,
      };
    }

    await admin
      .from("pagos_externos")
      .update({
        metadata: {
          descripcion: plan.nombre,
          miembroId: miembro.id,
          planId: plan.id,
          preference_id: pref.id,
        },
      })
      .eq("tenant_id", gym.id)
      .eq("external_id", refId);

    return { ok: true, initPoint: pref.initPoint };
  }
);

/**
 * Actualiza el teléfono del socio identificado por su QR tras el check-in.
 * Valida 10 dígitos; no lanza.
 */
export const actualizarTelefonoKioscoAction = kioscoAction(
  "kiosco.actualizar_telefono",
  {},
  async ({ gym, miembro, admin }, telefono: string): Promise<{ ok: boolean; error?: string }> => {
    const digits = (telefono || "").replace(/\D/g, "");
    if (digits.length !== 10) {
      return { ok: false, error: "Escribe un número de 10 dígitos." };
    }

    const { error } = await admin
      .from("miembros")
      .update({ telefono: digits })
      .eq("tenant_id", gym.id)
      .eq("id", miembro.id);
    if (error) return { ok: false, error: "No se pudo guardar." };
    return { ok: true };
  }
);
