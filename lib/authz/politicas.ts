/**
 * EL lugar donde se decide quién puede hacer qué.
 *
 * Cada Server Action declara una política por su clave; no puede inventar
 * la suya. Las claves son el id de la acción en el log de denegaciones y
 * en docs/autorizacion-acciones.md. Los gates de página (`requirePanel`,
 * PR 9) leen estas mismas entradas para que página y acción no diverjan.
 *
 * Fuentes: lib/features.ts (qué feature va en qué plan; ver
 * docs/gating-planes.md) y lib/permissions.ts (qué rol tiene qué permiso).
 *
 * Reglas:
 * - Panel: SIEMPRE feature + permission. Para "cualquier plan" se usa la
 *   feature descriptiva de Starter que corresponda (`miembros`,
 *   `caja_basica`, `checkins`…), que es verdad y verificable.
 * - `usar_panel` NO es un permiso: es la AUSENCIA DECLARADA de uno. Lo
 *   tienen los cuatro roles, así que significa "cualquier staff
 *   autenticado en este gym". Se usa para acciones que no restringen por
 *   rol (notificaciones, búsqueda, términos). Si dentro de seis meses lo
 *   lees como una restricción real, no lo es.
 * - Si una acción necesita dos features, declara la más específica y
 *   verifica la otra en el cuerpo con `ctx.has(...)`. Igual con permisos
 *   condicionales (`ctx.can(...)`).
 * - Portal y kiosco no tienen rol: la identidad la prueba la clase
 *   (sesión OTP del socio / qr_token). Admin no tiene plan.
 * - Anónimas: propósito de una unión cerrada; agregar uno es editar este
 *   archivo y aparece en el PR.
 */

import type { Feature } from "@/lib/features";
import type { Permission } from "@/lib/types/staff";
import type { AdminRole } from "@/lib/types/admin";

export interface PoliticaPanel {
  feature: Feature;
  permission: Permission;
}
export interface PoliticaPortal {
  feature: Feature;
}
export interface PoliticaKiosco {
  feature: Feature;
}
export interface PoliticaAdmin {
  rol: AdminRole;
}

// ─────────────────────────────────────────────────────────────────────────
// PANEL DEL GIMNASIO — app/(tenant)/**
// Se puebla carpeta por carpeta conforme se migra (PRs 4–7). Cada entrada
// lleva la acción que la usa; las marcadas "cierra:" hoy verifican rol
// pero no plan, y al migrar empezarán a exigir el plan declarado.
// ─────────────────────────────────────────────────────────────────────────
export const PANEL = {
  // ── caja/actions.ts ──
  /** registerPagoAction — cobro de membresía/visita/otro. */
  "caja.cobrar": { feature: "caja_basica", permission: "registrar_pagos" },
  /** registrarVisitaRapidaAction — visita suelta sin membresía. */
  "caja.visita_rapida": { feature: "caja_basica", permission: "registrar_pagos" },
  /** registrarAbonoAction — abono a plan de pagos. cierra: creditos (Pro). */
  "caja.abonar_plan_pago": { feature: "creditos", permission: "registrar_pagos" },
  /** anularPagoAction. */
  "caja.anular_pago": { feature: "caja_basica", permission: "cancelar_pagos" },
  /** reembolsarPagoAction — reembolso o nota de crédito. */
  "caja.reembolsar": { feature: "caja_basica", permission: "cancelar_pagos" },
  /**
   * registrarTicketAction — venta de productos desde caja. cierra: inventario
   * (Pro). Permiso: hoy la acción y la UI usan registrar_pagos, no
   * vender_desde_caja (que ningún componente consulta); se conserva para no
   * cambiar comportamiento en la migración.
   */
  "caja.vender_productos": { feature: "inventario", permission: "registrar_pagos" },
  /** getCreditoDisponibleAction — saldo de notas de crédito del socio. */
  "caja.credito_disponible": { feature: "caja_basica", permission: "registrar_pagos" },

  // ── caja/autorizaciones-actions.ts ──
  /** autorizarCodigoAction — confirma un código del kiosco. cierra: kiosco_autoservicio (Pro). */
  "caja.autorizar_codigo": { feature: "kiosco_autoservicio", permission: "registrar_pagos" },
  /** rechazarCodigoAction. cierra: kiosco_autoservicio (Pro). */
  "caja.rechazar_codigo": { feature: "kiosco_autoservicio", permission: "registrar_pagos" },

  // ── caja/corte-actions.ts ──
  /** abrirCorteAction. */
  "caja.abrir_corte": { feature: "caja_basica", permission: "registrar_pagos" },
  /** cerrarCorteAction. */
  "caja.cerrar_corte": { feature: "caja_basica", permission: "registrar_pagos" },

  // ── caja/mp-actions.ts ──
  /** crearCobroMpAction — link de pago MercadoPago desde caja (ya verificaba ambos ejes). */
  "caja.cobrar_mp": { feature: "mercadopago", permission: "registrar_pagos" },
} as const satisfies Record<string, PoliticaPanel>;

// ─────────────────────────────────────────────────────────────────────────
// PORTAL DEL SOCIO — app/portal/** (sesión OTP; el recurso es del socio)
// `portal_miembro` (Escala) se exige siempre además de la feature declarada;
// como Escala hereda todo Pro, ninguna de estas cierra nada en la práctica.
// Firma pública (slug, ...args); las queries reciben `session.miembroId` de
// ctx, nunca del input. Migrado en el PR 2.
// ─────────────────────────────────────────────────────────────────────────
export const PORTAL = {
  /** solicitarCongelacionAction — pausa de membresía pedida por el socio. */
  "portal.congelar": { feature: "portal_miembro" },
  /** enviarOpinionPortalAction — opinión mensual (ya verificaba opiniones). */
  "portal.opinar": { feature: "opiniones" },
  /** renovarMpAction — renovación en línea; hoy no verificaba mercadopago. */
  "portal.renovar_mp": { feature: "mercadopago" },
  /** reservarClasePortalAction — hoy no verificaba clases. */
  "portal.reservar_clase": { feature: "clases" },
  /** cancelarReservaPortalAction — la query exige que la reserva sea del socio. */
  "portal.cancelar_reserva": { feature: "clases" },
} as const satisfies Record<string, PoliticaPortal>;

// ─────────────────────────────────────────────────────────────────────────
// KIOSCO — app/kiosco/** (público; la identidad la prueba el qr_token)
// La firma pública de toda acción de kiosco es (slug, token, ...args): el
// handler recibe `ctx.miembro` ya resuelto del token y NO existe un
// `miembroId` que revalidar. Migrado en el PR 1.
// ─────────────────────────────────────────────────────────────────────────
export const KIOSCO = {
  /** checkInKioscoAction — self check-in con QR. Starter. */
  "kiosco.checkin": { feature: "qr_access" },
  /** identificarMiembroKioscoAction — paso 1 de compra en autoservicio. */
  "kiosco.identificar_compra": { feature: "kiosco_autoservicio" },
  /** crearCodigoCompraAction — código de autorización de compra. */
  "kiosco.codigo_compra": { feature: "kiosco_autoservicio" },
  /** identificarMembresiaKioscoAction — paso 1 de renovación en autoservicio. */
  "kiosco.identificar_membresia": { feature: "kiosco_autoservicio" },
  /** crearCodigoMembresiaAction — código de autorización de renovación. */
  "kiosco.codigo_membresia": { feature: "kiosco_autoservicio" },
  /**
   * renovarMembresiaMpKioscoAction — renovación pagada en línea. Hoy solo
   * verifica kiosco_autoservicio; mercadopago es la feature que realmente
   * ejerce (ambas Pro, sin cambio de plan efectivo). El cuerpo verifica
   * además `ctx.has("kiosco_autoservicio")`.
   */
  "kiosco.renovar_mp": { feature: "mercadopago" },
  /** actualizarTelefonoKioscoAction — captura de teléfono tras el check-in. Starter. */
  "kiosco.actualizar_telefono": { feature: "qr_access" },
} as const satisfies Record<string, PoliticaKiosco>;

// ─────────────────────────────────────────────────────────────────────────
// PANEL ADMIN DE STRING — app/admin/** (string_admins; sin plan ni rol de gym)
// Decisión 2026-09-20: `super_admin` = lo que afecta facturación, existencia
// o acceso a la cuenta de un tenant; `admin` = soporte diario. La distinción
// vive SOLO aquí: `is_super_admin()` en SQL mira únicamente `activo` (deuda
// anotada en docs/autorizacion-acciones.md §7, cerrar antes de dar de alta
// un segundo admin). Migrado en el PR 3.
// ─────────────────────────────────────────────────────────────────────────
export const ADMIN = {
  // ── tenants/[tenantId]/actions.ts ──
  /** cancelarTenantAction — irreversible; exporta y envía los datos del gym. */
  "admin.cancelar_tenant": { rol: "super_admin" },
  /** suspenderTenantAction — corta el servicio a un gym vivo. */
  "admin.suspender_tenant": { rol: "super_admin" },
  /** reactivarTenantAction — deshace una suspensión. */
  "admin.reactivar_tenant": { rol: "admin" },
  /** cambiarPlanAction — cambia lo que se cobra. */
  "admin.cambiar_plan": { rol: "super_admin" },
  /** activarPlanPagadoAction — prueba → pagado: nace la facturación. */
  "admin.activar_plan_pagado": { rol: "super_admin" },
  /** marcarFundadorAction — precio de por vida. */
  "admin.marcar_fundador": { rol: "super_admin" },
  /** toggleAddonAction — facturación. */
  "admin.toggle_addon": { rol: "super_admin" },
  /** resetPasswordOwnerAction — reset al dueño: vector de toma de cuenta. */
  "admin.reset_password_owner": { rol: "super_admin" },
  /** extenderPruebaAction — soporte/ventas; el schema acota los días. */
  "admin.extender_prueba": { rol: "admin" },
  /** registrarPagoManualAction — afirmar que entró dinero = facturación. */
  "admin.registrar_pago_manual": { rol: "super_admin" },
  /** agregarNotaInternaAction. */
  "admin.nota_interna": { rol: "admin" },

  // ── solicitudes/actions.ts ──
  /** contactadoAction / descartarAction — funnel de solicitudes. */
  "admin.solicitud_contactado": { rol: "admin" },
  "admin.solicitud_descartar": { rol: "admin" },
  /** activarSolicitudAction — crea el tenant y la cuenta del dueño: nacimiento de la relación comercial. */
  "admin.solicitud_activar": { rol: "super_admin" },

  // ── eventos/actions.ts ──
  /** exportEventosCsv — lectura del audit log (la RLS ya lo acota). */
  "admin.exportar_eventos": { rol: "admin" },

  // ── cuenta/actions.ts ──
  /** cambiarPasswordAction — sobre la propia cuenta. */
  "admin.cambiar_password": { rol: "admin" },
  /** cerrarTodasSesionesAction — sobre la propia cuenta; antes no validaba admin. */
  "admin.cerrar_sesiones": { rol: "admin" },
} as const satisfies Record<string, PoliticaAdmin>;

// ─────────────────────────────────────────────────────────────────────────
// ANÓNIMAS — sin sesión por definición. Unión cerrada: agregar un
// propósito es editar esta lista.
// ─────────────────────────────────────────────────────────────────────────
export type PropositoAnon =
  | "login_staff" // app/(auth)/login
  | "recuperar_password" // app/(auth)/recuperar-password
  | "aceptar_invitacion" // app/auth/accept-invite
  | "cerrar_sesion_staff" // app/(tenant)/[slug]/suspendida (signOut; el gym puede estar bloqueado)
  | "otp_portal_solicitar" // app/portal/[slug]/login
  | "otp_portal_verificar"
  | "cerrar_sesion_portal" // app/portal/[slug]/actions.ts (borra cookie aunque la sesión ya expiró)
  | "login_admin" // app/admin/login
  | "cerrar_sesion_admin"; // app/admin/(panel)/actions.ts (signOut aunque la sesión ya no sea de admin)

export type PoliticaPanelId = keyof typeof PANEL;
export type PoliticaPortalId = keyof typeof PORTAL;
export type PoliticaKioscoId = keyof typeof KIOSCO;
export type PoliticaAdminId = keyof typeof ADMIN;
