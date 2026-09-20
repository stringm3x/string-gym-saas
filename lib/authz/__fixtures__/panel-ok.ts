// Fixture de tipos: módulo del panel correcto (una acción + una anónima).
import { panelAction, anonAction } from "../index";

export const cobrarAction = panelAction(
  "caja.cobrar",
  {},
  async (ctx, monto: number): Promise<{ ok: boolean; error?: string; tenantId?: string }> => ({
    ok: monto > 0,
    tenantId: ctx.id,
  })
);

export const salirAction = anonAction("cerrar_sesion_staff", async () => ({ ok: true }));
