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
  // ── caja/actions.ts ── (migrado en el PR 4)
  /**
   * registerPagoAction — cobro rápido de membresía/visita/producto/otro. Si
   * el concepto es producto, el cuerpo exige además `has("inventario")` y
   * `can("vender_desde_caja")`. cierra: inventario (Pro) solo para productos.
   */
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
   * registrarTicketAction — ticket multi-línea (membresía y/o productos). Un
   * ticket solo de membresía es caja básica; las líneas de producto exigen en
   * el cuerpo `has("inventario")` y `can("vender_desde_caja")`. cierra:
   * inventario (Pro) solo para productos. Decisión PR 4: vender_desde_caja se
   * USA (aquí y en caja.cobrar) en vez de borrarse; la página de caja oculta
   * los productos con el mismo par feature+permiso.
   */
  "caja.ticket": { feature: "caja_basica", permission: "registrar_pagos" },
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

  // ── miembros/actions.ts ── (migrado en el PR 5)
  /**
   * createMiembroAction. En el cuerpo: cobrar la inscripción exige
   * can("registrar_pagos"); tag_ids exige has("tags"). cierra: tags (Pro)
   * solo si el form trae etiquetas.
   */
  "miembros.crear": { feature: "miembros", permission: "crear_miembros" },
  /** updateMiembroAction. tag_ids exige has("tags") en el cuerpo. */
  "miembros.editar": { feature: "miembros", permission: "editar_miembros" },
  /** updateNotasLegacyAction — campo de notas libre de la ficha. */
  "miembros.notas_legacy": { feature: "miembros", permission: "editar_miembros" },
  /** archivarMiembroAction / restaurarMiembroAction. */
  "miembros.archivar": { feature: "archivar_miembros", permission: "eliminar_archivar_miembros" },
  "miembros.restaurar": { feature: "archivar_miembros", permission: "eliminar_archivar_miembros" },
  /** bulkAsignarTagAction. Cuerpo: has("tags"). cierra: bulk_actions + tags (Pro). */
  "miembros.bulk_tag": { feature: "bulk_actions", permission: "editar_miembros" },

  // ── miembros/importar/actions.ts ──
  /**
   * parsearCSVAction / importarMiembrosAction. Hoy `role === "owner"` a mano;
   * no existe un permiso "solo owner", y gerente = owner menos planes y
   * promociones, así que se declara configurar_general (owner + gerente).
   */
  "miembros.importar_previsualizar": { feature: "importacion_csv", permission: "configurar_general" },
  "miembros.importar": { feature: "importacion_csv", permission: "configurar_general" },

  // ── miembros/qr-actions.ts ──
  /** regenerarQrAction — invalida el QR del socio. Mismo criterio que importar: owner + gerente. */
  "miembros.regenerar_qr": { feature: "qr_access", permission: "configurar_general" },

  // ── miembros/[id]/membresia-actions.ts ──
  /** congelar / descongelar / aprobar / rechazar congelación. */
  "miembros.congelar": { feature: "miembros", permission: "editar_miembros" },
  "miembros.descongelar": { feature: "miembros", permission: "editar_miembros" },
  "miembros.aprobar_congelacion": { feature: "miembros", permission: "editar_miembros" },
  "miembros.rechazar_congelacion": { feature: "miembros", permission: "editar_miembros" },
  /** previsualizarCambioPlanAction / cambiarPlanAction — prorratea y puede mover dinero. */
  "miembros.previsualizar_cambio_plan": { feature: "catalogo_planes", permission: "registrar_pagos" },
  "miembros.cambiar_plan": { feature: "catalogo_planes", permission: "registrar_pagos" },

  // ── miembros/[id]/renovar-actions.ts ──
  /** renovarMiembroAction — renovación en un clic (cobra). */
  "miembros.renovar": { feature: "caja_basica", permission: "registrar_pagos" },

  // ── miembros/[id]/creditos-actions.ts ── (ya verificaban ambos ejes)
  "miembros.plan_pago_crear": { feature: "creditos", permission: "registrar_pagos" },
  "miembros.cuota_pagar": { feature: "creditos", permission: "registrar_pagos" },

  // ── miembros/[id]/nutricion-actions.ts ── (ya verificaban ambos ejes)
  "miembros.nutricion_crear": { feature: "nutricion", permission: "gestionar_nutricion" },
  "miembros.nutricion_editar": { feature: "nutricion", permission: "gestionar_nutricion" },
  "miembros.nutricion_archivar": { feature: "nutricion", permission: "gestionar_nutricion" },

  // ── configuracion/** ── (migrado en el PR 6)
  // Paridad con las páginas: cada page.tsx de configuración ya gatea con la
  // misma feature que aquí se declara (ConfigNav también). Sin excepciones
  // al modelo de gerente: cajas y staff declaran configurar_general /
  // gestionar_staff (owner + gerente); el `requireOwner()` engañoso murió.
  /** regenerarApiKeyAction (ya verificaba ambos ejes). */
  "config.api_regenerar": { feature: "api", permission: "configurar_general" },
  /** cajas/actions.ts — múltiples cajas es caja básica. */
  "config.caja_crear": { feature: "caja_basica", permission: "configurar_general" },
  "config.caja_renombrar": { feature: "caja_basica", permission: "configurar_general" },
  "config.caja_desactivar": { feature: "caja_basica", permission: "configurar_general" },
  "config.caja_reactivar": { feature: "caja_basica", permission: "configurar_general" },
  "config.caja_requiere_cuadre": { feature: "caja_basica", permission: "configurar_general" },
  /** clases/actions.ts (ya verificaban ambos ejes). */
  "config.clases_noshow": { feature: "clases", permission: "configurar_general" },
  "config.clase_crear": { feature: "clases", permission: "configurar_general" },
  "config.clase_editar": { feature: "clases", permission: "configurar_general" },
  "config.clase_toggle": { feature: "clases", permission: "configurar_general" },
  "config.clase_generar_sesiones": { feature: "clases", permission: "configurar_general" },
  /** updateGymConfigAction — datos del gym y reglas de check-in/congelación (Starter). */
  "config.gym": { feature: "miembros", permission: "configurar_general" },
  /** guardarGooglePlaceIdAction — reseñas en Google. cierra: opiniones (Pro); la página ya lo oculta. */
  "config.google_place_id": { feature: "opiniones", permission: "configurar_general" },
  /** updateMarcaAction (ya verificaba ambos ejes). */
  "config.marca_color": { feature: "color_gimnasio", permission: "configurar_general" },
  "config.logo_subir": { feature: "personalizacion_logo", permission: "configurar_general" },
  "config.logo_borrar": { feature: "personalizacion_logo", permission: "configurar_general" },
  /** pagos/actions.ts (ya verificaban ambos ejes). */
  "config.mp_conectar": { feature: "mercadopago", permission: "configurar_general" },
  "config.mp_desconectar": { feature: "mercadopago", permission: "configurar_general" },
  /** planes/actions.ts — catálogo de planes (Starter). */
  "config.plan_crear": { feature: "catalogo_planes", permission: "configurar_planes_promociones" },
  "config.plan_editar": { feature: "catalogo_planes", permission: "configurar_planes_promociones" },
  "config.plan_toggle": { feature: "catalogo_planes", permission: "configurar_planes_promociones" },
  /** plantillas/actions.ts. cierra: plantillas_mensaje (Pro); la página ya lo gatea. */
  "config.plantilla_crear": { feature: "plantillas_mensaje", permission: "configurar_planes_promociones" },
  "config.plantilla_editar": { feature: "plantillas_mensaje", permission: "configurar_planes_promociones" },
  "config.plantilla_borrar": { feature: "plantillas_mensaje", permission: "configurar_planes_promociones" },
  "config.plantilla_toggle": { feature: "plantillas_mensaje", permission: "configurar_planes_promociones" },
  "config.plantillas_seed": { feature: "plantillas_mensaje", permission: "configurar_planes_promociones" },
  /** promociones/actions.ts. cierra: promociones (Pro); la página ya lo gatea. */
  "config.promocion_crear": { feature: "promociones", permission: "configurar_planes_promociones" },
  "config.promocion_editar": { feature: "promociones", permission: "configurar_planes_promociones" },
  "config.promocion_toggle": { feature: "promociones", permission: "configurar_planes_promociones" },
  /** tags/actions.ts. cierra: tags (Pro); la página ya lo gatea. */
  "config.tag_crear": { feature: "tags", permission: "configurar_planes_promociones" },
  "config.tag_editar": { feature: "tags", permission: "configurar_planes_promociones" },
  "config.tag_borrar": { feature: "tags", permission: "configurar_planes_promociones" },
  /**
   * staff/actions.ts. inviteStaff ya exigía multiusuario; las otras 8 solo
   * rol. cierra: multiusuario (Pro) para gestionar el equipo existente — la
   * página entera de staff ya es Pro. toggleCajaCheckinPin conserva el
   * guard ERROR_SOLO_OWNER por la RLS de gyms, no por el código.
   */
  "config.staff_invitar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_reenviar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_cancelar_invitacion": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_desactivar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_reactivar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_eliminar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_pin_asignar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.staff_pin_quitar": { feature: "multiusuario", permission: "gestionar_staff" },
  "config.caja_pin_checkin": { feature: "multiusuario", permission: "gestionar_staff" },
  /** updateWhatsappConfigAction (ya verificaba ambos ejes). */
  "config.whatsapp": { feature: "whatsapp_automatico", permission: "configurar_general" },

  // ── resto del panel ── (migrado en el PR 7; cierra el panel)
  /** buscarMiembrosAction (buscar-actions.ts) — búsqueda global; hoy sin auth. */
  "panel.buscar_miembros": { feature: "miembros", permission: "usar_panel" },
  /**
   * aceptarTerminosAction. DECISIÓN (2026-09-20): aceptar los Términos tiene
   * efecto legal sobre la cuenta y lo hace quien es DUEÑO de la cuenta, no
   * quien la administra. Eso lo garantiza el layout raíz, que solo muestra
   * el modal al owner (`debeAceptarTerminos`). Que la acción sea
   * `usar_panel` es un detalle sin consecuencia mientras el modal siga
   * siendo solo del owner — NO lo "arregles" moviéndolo a otro permiso, y
   * si alguna vez el modal se abre a más roles, esta política tiene que
   * cambiar con él.
   */
  "panel.aceptar_terminos": { feature: "miembros", permission: "usar_panel" },
  /**
   * notificaciones-actions.ts. `usar_panel` NO es un permiso: es la ausencia
   * declarada de uno. Lo tienen los cuatro roles = "cualquier staff
   * autenticado". El inbox de notificaciones es compartido por todo el gym
   * (gym_notifications no tiene destinatario), así que no hay rol que
   * restringir; se declara para que quede explícito y greppable.
   */
  "notificaciones.marcar_leida": { feature: "miembros", permission: "usar_panel" },
  "notificaciones.marcar_todas": { feature: "miembros", permission: "usar_panel" },
  /** checkins/actions.ts — hoy sin auth. */
  "checkins.registrar": { feature: "checkins", permission: "hacer_checkin_manual" },
  "checkins.buscar": { feature: "checkins", permission: "hacer_checkin_manual" },
  /** checkins/scanner — hoy sin auth en la acción (la página gatea qr_access + ver_checkins_dia). */
  "checkins.qr": { feature: "qr_access", permission: "hacer_checkin_manual" },
  /** clases/[sesionId] (ya verificaban ambos ejes: ver_clases opera, gestionar_clases cancela sesión). */
  "clases.buscar_miembros": { feature: "clases", permission: "ver_clases" },
  "clases.reservar": { feature: "clases", permission: "ver_clases" },
  "clases.cancelar_reserva": { feature: "clases", permission: "ver_clases" },
  "clases.checkin_reserva": { feature: "clases", permission: "ver_clases" },
  "clases.no_show": { feature: "clases", permission: "ver_clases" },
  "clases.cancelar_sesion": { feature: "clases", permission: "gestionar_clases" },
  /** enviarCampanaAction — hoy solo feature; el sidebar la muestra con ver_dashboard_ingresos (owner + gerente). */
  "campanas.enviar": { feature: "campanas", permission: "ver_dashboard_ingresos" },
  /**
   * Inbox de WhatsApp — hoy solo feature. El sidebar lo muestra a todo el
   * staff ("contestar es operación diaria"), así que `usar_panel` (ausencia
   * declarada de permiso, ver arriba).
   */
  "inbox.marcar_leida": { feature: "whatsapp_automatico", permission: "usar_panel" },
  "inbox.toggle_bot": { feature: "whatsapp_automatico", permission: "usar_panel" },
  "inbox.enviar": { feature: "whatsapp_automatico", permission: "usar_panel" },
  /** inventario/actions.ts. cierra: inventario (Pro); el layout ya lo gatea. */
  "inventario.producto_crear": { feature: "inventario", permission: "ver_inventario_movimientos" },
  "inventario.producto_editar": { feature: "inventario", permission: "ver_inventario_movimientos" },
  "inventario.movimiento": { feature: "inventario", permission: "ver_inventario_movimientos" },
  /**
   * notas/actions.ts. `usar_panel` = ausencia declarada de permiso (cualquier
   * staff): las notas son operación diaria de los cuatro roles. Las notas de
   * PROSPECTO además exigen can("ver_prospectos") en el cuerpo, porque el
   * prospecto en sí solo lo ven owner y gerente. cierra: timeline_notas
   * (Pro); la ficha del socio ya lo gatea.
   */
  "notas.crear": { feature: "timeline_notas", permission: "usar_panel" },
  "notas.toggle_completada": { feature: "timeline_notas", permission: "usar_panel" },
  "notas.registrar_accion": { feature: "timeline_notas", permission: "usar_panel" },
  "notas.listar": { feature: "timeline_notas", permission: "usar_panel" },
  /** completarOnboardingAction — hoy sin auth; es la guía del dueño. */
  "onboarding.completar": { feature: "miembros", permission: "configurar_general" },
  /** prospectos/actions.ts. cierra: prospectos (Pro); la página ya lo gatea. */
  "prospectos.crear": { feature: "prospectos", permission: "ver_prospectos" },
  "prospectos.editar": { feature: "prospectos", permission: "ver_prospectos" },
  "prospectos.cambiar_estado": { feature: "prospectos", permission: "ver_prospectos" },
  /** getReporteCsvAction. cierra: reportes (Pro); la página ya lo gatea. */
  "reportes.csv": { feature: "reportes", permission: "ver_dashboard_ingresos" },

  // ── pagina.* — PÁGINAS SIN ACCIÓN PROPIA ── (PR 9b)
  // Estas entradas NO gatean ninguna Server Action: no la busques. Existen
  // porque `requirePanel()` (lib/authz/pagina.ts) exige que TODA página del
  // panel lea su gate de este archivo, y estas pantallas son de solo lectura
  // (o sus acciones viven en otra carpeta). El criterio es el mismo que usa
  // el sidebar para mostrar el link, para que link y pantalla no diverjan.
  /** /alertas — lectura de alertas del dueño. */
  "pagina.alertas": { feature: "alertas_dueno", permission: "ver_alertas" },
  /** /dashboard — panel del mes; la sección MRR/ARPU/LTV además pide dashboard_completo en la página. */
  "pagina.dashboard": { feature: "dashboard_simple", permission: "ver_dashboard_completo" },
  /** /hoy — panel del día. */
  "pagina.hoy": { feature: "pantalla_hoy", permission: "ver_pantalla_hoy" },
  /** /opiniones — resumen de opiniones; el sidebar lo muestra con ver_dashboard_ingresos (owner + gerente). */
  "pagina.opiniones": { feature: "opiniones", permission: "ver_dashboard_ingresos" },
  /** /inventario/* (layout) — ver el catálogo; las mutaciones exigen ver_inventario_movimientos en sus acciones. */
  "pagina.inventario": { feature: "inventario", permission: "ver_inventario_stock" },
  /** /configuracion/* (layout) — entrar a Configuración; cada página exige además lo de su acción. */
  "pagina.configuracion": { feature: "miembros", permission: "configurar_general" },
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
