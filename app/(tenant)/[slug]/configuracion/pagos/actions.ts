"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import {
  saveMpCredentials,
  clearMpCredentials,
} from "@/lib/queries/mercadopago.queries";

export interface MpActionResult {
  ok: boolean;
  error?: string;
  email?: string | null;
}

async function gate() {
  const tenant = await getTenant();
  if (
    !hasPermission(tenant.role, "configurar_general") ||
    !hasFeature(tenant.plan, "mercadopago")
  ) {
    return null;
  }
  return tenant;
}

/**
 * Guarda el access token de MercadoPago del gym, validándolo antes contra
 * la API de MP (GET /users/me). Si es válido, persiste token + email + user_id.
 */
export async function guardarMpTokenAction(
  accessToken: string
): Promise<MpActionResult> {
  const tenant = await gate();
  if (!tenant) return { ok: false, error: "No autorizado." };

  const token = (accessToken || "").trim();
  if (!token) return { ok: false, error: "Pega tu Access Token." };

  // Validar el token contra MercadoPago.
  let me: { id?: number | string; email?: string } | null = null;
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: "Token inválido. Verifícalo e inténtalo de nuevo." };
    }
    me = await res.json();
  } catch {
    return { ok: false, error: "No se pudo validar el token con MercadoPago." };
  }

  const saved = await saveMpCredentials(tenant.id, {
    token,
    email: me?.email ?? null,
    userId: me?.id != null ? String(me.id) : null,
  });
  if (!saved.ok) return { ok: false, error: saved.error };

  revalidatePath(`/${tenant.slug}/configuracion/pagos`);
  return { ok: true, email: me?.email ?? null };
}

export async function desconectarMpAction(): Promise<MpActionResult> {
  const tenant = await gate();
  if (!tenant) return { ok: false, error: "No autorizado." };

  const cleared = await clearMpCredentials(tenant.id);
  if (!cleared.ok) return { ok: false, error: cleared.error };

  revalidatePath(`/${tenant.slug}/configuracion/pagos`);
  return { ok: true };
}
