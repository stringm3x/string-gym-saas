"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { getMiembroByQrToken } from "@/lib/queries/qr.queries";
import { createCheckin } from "@/lib/queries/checkins.queries";
import { randomUUID } from "node:crypto";
import {
  getProductosKiosco,
  getPlanesMembresiaKiosco,
  crearCodigoAutorizacion,
  type KioscoProducto,
  type KioscoPlan,
} from "@/lib/queries/kiosco.queries";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";

export type KioscoError =
  | "QR_NO_ENCONTRADO"
  | "MIEMBRO_ARCHIVADO"
  | "MEMBRESIA_VENCIDA"
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
    }
  | { success: false; error: KioscoError; nombre?: string };

/** Teléfono ausente o placeholder → conviene pedirlo. */
function sinTelefono(tel: string | null): boolean {
  const t = (tel ?? "").replace(/\D/g, "");
  return t.length === 0 || t === "0000000000";
}

function hoyYMD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Self check-in público: el miembro escanea su propio QR, sin staff ni sesión.
 * Resuelve el gym por slug (admin client), valida plan Pro+, y registra el
 * check-in si la membresía está vigente. Tenant-scoped por el id del gym.
 */
export async function checkInKioscoAction(
  slug: string,
  token: string
): Promise<KioscoResult> {
  const admin = createAdminClient();

  const { data: gym } = await admin
    .from("gyms")
    .select("id, plan")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return { success: false, error: "QR_NO_ENCONTRADO" };
  if (!hasFeature(gym.plan as Plan, "qr_access")) {
    return { success: false, error: "NO_DISPONIBLE" };
  }

  const t = (token || "").trim();
  if (!t) return { success: false, error: "QR_NO_ENCONTRADO" };

  const miembro = await getMiembroByQrToken(gym.id, t, admin);
  if (!miembro) return { success: false, error: "QR_NO_ENCONTRADO" };
  if (miembro.archivado) {
    return { success: false, error: "MIEMBRO_ARCHIVADO", nombre: miembro.nombre };
  }
  if (miembro.fecha_vencimiento && miembro.fecha_vencimiento < hoyYMD()) {
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
  };
}

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

/** Resuelve el gym de autoservicio por slug (valida feature). */
async function gymAutoservicio(slug: string) {
  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id, plan, mp_access_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return { error: "Gimnasio no encontrado." as const };
  if (!hasFeature(gym.plan as Plan, "kiosco_autoservicio")) {
    return { error: "El autoservicio no está disponible en este gimnasio." as const };
  }
  return { gym };
}

/**
 * Identifica al miembro por su QR (sin registrar entrada) y devuelve el
 * catálogo de productos disponibles para comprar en el kiosco.
 */
export async function identificarMiembroKioscoAction(
  slug: string,
  token: string
): Promise<IdentificarResult> {
  const res = await gymAutoservicio(slug);
  if (!res.gym) return { ok: false, error: res.error };
  const gym = res.gym;

  const admin = createAdminClient();
  const miembro = await getMiembroByQrToken(gym.id, (token || "").trim(), admin);
  if (!miembro) return { ok: false, error: "QR no válido." };
  if (miembro.archivado) return { ok: false, error: "Cuenta inactiva." };

  const productos = await getProductosKiosco(gym.id);

  return {
    ok: true,
    miembro: { id: miembro.id, nombre: miembro.nombre },
    productos,
    mpDisponible: !!gym.mp_access_token,
  };
}

/**
 * Genera un código de autorización para una compra. El total y el stock se
 * recalculan en el servidor; el staff cobra y descuenta stock al autorizar.
 */
export async function crearCodigoCompraAction(
  slug: string,
  miembroId: string,
  items: { producto_id: string; cantidad: number }[],
  metodo: KioscoMetodo
): Promise<CodigoResult> {
  if (!METODOS.includes(metodo)) {
    return { ok: false, error: "Método de pago inválido." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Selecciona al menos un producto." };
  }

  const res = await gymAutoservicio(slug);
  if (!res.gym) return { ok: false, error: res.error };
  const gym = res.gym;

  // El miembro debe pertenecer al gym (defensa: viene del cliente).
  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("miembros")
    .select("id")
    .eq("tenant_id", gym.id)
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, error: "Miembro no válido." };

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
    miembroId,
  });
  if (!r.ok) return { ok: false, error: r.error ?? "No se pudo generar el código." };

  return { ok: true, codigo: r.codigo!, expiraAt: r.expiraAt! };
}

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
export async function identificarMembresiaKioscoAction(
  slug: string,
  token: string
): Promise<IdentificarMembresiaResult> {
  const res = await gymAutoservicio(slug);
  if (!res.gym) return { ok: false, error: res.error };
  const gym = res.gym;

  const admin = createAdminClient();
  const miembro = await getMiembroByQrToken(gym.id, (token || "").trim(), admin);
  if (!miembro) return { ok: false, error: "QR no válido." };
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

/** Valida que el plan exista y esté activo en el gym (admin). */
async function planValido(gymId: string, planId: string) {
  const admin = createAdminClient();
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
export async function crearCodigoMembresiaAction(
  slug: string,
  miembroId: string,
  planId: string,
  metodo: "efectivo" | "transferencia"
): Promise<CodigoResult> {
  if (metodo !== "efectivo" && metodo !== "transferencia") {
    return { ok: false, error: "Método de pago inválido." };
  }

  const res = await gymAutoservicio(slug);
  if (!res.gym) return { ok: false, error: res.error };
  const gym = res.gym;

  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("miembros")
    .select("id")
    .eq("tenant_id", gym.id)
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, error: "Miembro no válido." };

  const plan = await planValido(gym.id, planId);
  if (!plan) return { ok: false, error: "Ese plan no está disponible." };

  const r = await crearCodigoAutorizacion({
    tenantId: gym.id,
    tipo: "membresia",
    payload: {
      planId: plan.id,
      planNombre: plan.nombre,
      monto: plan.precio,
      metodo,
      miembroId,
    },
    miembroId,
  });
  if (!r.ok) return { ok: false, error: r.error ?? "No se pudo generar el código." };

  return { ok: true, codigo: r.codigo!, expiraAt: r.expiraAt! };
}

/**
 * Inicia la renovación con MercadoPago desde el kiosco. Crea `pagos_externos`
 * (pending) con miembroId+planId; el webhook de la Fase 7.9 confirma el pago
 * y extiende el vencimiento automáticamente.
 */
export async function renovarMembresiaMpKioscoAction(
  slug: string,
  miembroId: string,
  planId: string
): Promise<RenovarMpResult> {
  const res = await gymAutoservicio(slug);
  if (!res.gym) return { ok: false, error: res.error };
  const gym = res.gym;

  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("miembros")
    .select("id, email")
    .eq("tenant_id", gym.id)
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, error: "Miembro no válido." };

  const plan = await planValido(gym.id, planId);
  if (!plan) return { ok: false, error: "Ese plan no está disponible." };

  const refId = randomUUID();
  const { error: insErr } = await admin.from("pagos_externos").insert({
    tenant_id: gym.id,
    proveedor: "mercadopago",
    external_id: refId,
    status: "pending",
    monto: plan.precio,
    metadata: { descripcion: plan.nombre, miembroId, planId: plan.id },
  });
  if (insErr) return { ok: false, error: "No se pudo iniciar el pago." };

  const domain = process.env.APP_DOMAIN ?? "app.gym.stringwebs.com";
  const kioscoUrl = `https://${domain}/kiosco/${slug}`;

  const pref = await createCheckoutPreference(gym.id, {
    titulo: plan.nombre,
    monto: plan.precio,
    successUrl: kioscoUrl,
    failureUrl: kioscoUrl,
    pendingUrl: kioscoUrl,
    externalReference: refId,
    payerEmail: (miembro.email as string | null) || undefined,
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
        miembroId,
        planId: plan.id,
        preference_id: pref.id,
      },
    })
    .eq("tenant_id", gym.id)
    .eq("external_id", refId);

  return { ok: true, initPoint: pref.initPoint };
}

/**
 * Actualiza el teléfono de un miembro desde el kiosco (público, sin sesión).
 * Scoped por gym (slug) + id del miembro. No lanza; valida 10 dígitos.
 */
export async function actualizarTelefonoKioscoAction(
  slug: string,
  miembroId: string,
  telefono: string
): Promise<{ ok: boolean; error?: string }> {
  const digits = (telefono || "").replace(/\D/g, "");
  if (digits.length !== 10) {
    return { ok: false, error: "Escribe un número de 10 dígitos." };
  }

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return { ok: false, error: "Gimnasio no encontrado." };

  const { error } = await admin
    .from("miembros")
    .update({ telefono: digits })
    .eq("tenant_id", gym.id)
    .eq("id", miembroId);
  if (error) return { ok: false, error: "No se pudo guardar." };
  return { ok: true };
}
