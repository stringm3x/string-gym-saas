"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  recargarSaldo,
  consumirSaldo,
  ajustarSaldo,
} from "@/lib/queries/saldo.queries";
import {
  recargaSaldoSchema,
  consumoSaldoSchema,
  ajusteSaldoSchema,
} from "@/lib/validations/saldo.schema";

interface Result {
  ok: boolean;
  error?: string;
  saldo?: number;
}

async function contexto() {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "saldo_miembro")) {
    return { error: "Tu plan no incluye Saldo del miembro." as const };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." as const };
  return { tenant, userId: user.id };
}

export async function recargarSaldoAction(
  miembroId: string,
  input: unknown
): Promise<Result> {
  const ctx = await contexto();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!hasPermission(ctx.tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No autorizado." };
  }
  const parsed = recargaSaldoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const r = await recargarSaldo(
    ctx.tenant.id,
    miembroId,
    parsed.data.monto,
    parsed.data.concepto,
    ctx.userId
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/${ctx.tenant.slug}/miembros/${miembroId}`);
  return { ok: true, saldo: r.saldo };
}

export async function consumirSaldoAction(
  miembroId: string,
  input: unknown
): Promise<Result> {
  const ctx = await contexto();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!hasPermission(ctx.tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No autorizado." };
  }
  const parsed = consumoSaldoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const r = await consumirSaldo(
    ctx.tenant.id,
    miembroId,
    parsed.data.monto,
    parsed.data.concepto,
    null,
    ctx.userId
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/${ctx.tenant.slug}/miembros/${miembroId}`);
  return { ok: true, saldo: r.saldo };
}

export async function ajustarSaldoAction(
  miembroId: string,
  input: unknown
): Promise<Result> {
  const ctx = await contexto();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  // Ajuste manual: solo owner.
  if (ctx.tenant.role !== "owner") {
    return { ok: false, error: "Solo el dueño puede hacer ajustes." };
  }
  const parsed = ajusteSaldoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const r = await ajustarSaldo(
    ctx.tenant.id,
    miembroId,
    parsed.data.monto,
    parsed.data.concepto,
    ctx.userId
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/${ctx.tenant.slug}/miembros/${miembroId}`);
  return { ok: true, saldo: r.saldo };
}
