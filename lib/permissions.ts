import type { StaffRol, Permission } from "./types/staff";

/**
 * `usar_panel` NO es un permiso: es la ausencia declarada de uno. Lo tienen
 * los cuatro roles, así que en la práctica significa "cualquier staff
 * autenticado en este gym". Existe para que las acciones del panel que no
 * restringen por rol (notificaciones, búsqueda, términos) lo digan de forma
 * explícita y greppable en lib/authz/politicas.ts, en vez de dejar el eje
 * de rol en blanco. No lo leas como una restricción real.
 */
const USAR_PANEL: Permission = "usar_panel";

const OWNER_PERMISSIONS: Permission[] = [
  USAR_PANEL,
  "ver_dashboard_ingresos",
  "ver_checkins_dia",
  "crear_miembros",
  "editar_miembros",
  "eliminar_archivar_miembros",
  "registrar_pagos",
  "cancelar_pagos",
  "ver_historial_pagos_completo",
  "ver_historial_pagos_dia",
  "hacer_checkin_manual",
  "ver_inventario_stock",
  "ver_inventario_movimientos",
  "vender_desde_caja",
  "ver_prospectos",
  "configurar_planes_promociones",
  "gestionar_staff",
  "configurar_general",
  "ver_alertas",
  "ver_dashboard_completo",
  "ver_pantalla_hoy",
  "ver_clases",
  "gestionar_clases",
  "ver_nutricion",
  "gestionar_nutricion",
];

const PERMISSIONS_BY_ROLE: Record<StaffRol, Permission[]> = {
  owner: OWNER_PERMISSIONS,
  // Gerente: todo lo del owner excepto configurar planes/promociones (D6).
  gerente: OWNER_PERMISSIONS.filter(
    (p) => p !== "configurar_planes_promociones"
  ),
  receptionist: [
    USAR_PANEL,
    "ver_checkins_dia",
    "crear_miembros",
    "editar_miembros",
    "registrar_pagos",
    "ver_historial_pagos_dia",
    "hacer_checkin_manual",
    "ver_inventario_stock",
    "vender_desde_caja",
    "ver_clases",
  ],
  // Entrenador: clases, socios y nutrición; sin caja ni finanzas (D6).
  entrenador: [
    USAR_PANEL,
    "ver_pantalla_hoy",
    "ver_checkins_dia",
    "hacer_checkin_manual",
    "crear_miembros",
    "editar_miembros",
    "ver_clases",
    "gestionar_clases",
    "ver_nutricion",
    "gestionar_nutricion",
  ],
};

export function hasPermission(rol: StaffRol, permission: Permission): boolean {
  return PERMISSIONS_BY_ROLE[rol]?.includes(permission) ?? false;
}

export function getPermissions(rol: StaffRol): Permission[] {
  return PERMISSIONS_BY_ROLE[rol] ?? [];
}

/** Complemento de "No tienes permiso para …" en las denegaciones (lib/authz). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  usar_panel: "usar el panel",
  ver_dashboard_ingresos: "ver los ingresos",
  ver_checkins_dia: "ver los check-ins del día",
  crear_miembros: "crear miembros",
  editar_miembros: "editar miembros",
  eliminar_archivar_miembros: "archivar o eliminar miembros",
  registrar_pagos: "cobrar",
  cancelar_pagos: "anular o reembolsar pagos",
  ver_historial_pagos_completo: "ver el historial completo de pagos",
  ver_historial_pagos_dia: "ver los pagos del día",
  hacer_checkin_manual: "registrar check-ins",
  ver_inventario_stock: "ver el inventario",
  ver_inventario_movimientos: "ver los movimientos de inventario",
  vender_desde_caja: "vender productos",
  ver_prospectos: "ver prospectos",
  configurar_planes_promociones: "configurar planes y promociones",
  gestionar_staff: "gestionar el equipo",
  configurar_general: "cambiar la configuración",
  ver_alertas: "ver alertas",
  ver_dashboard_completo: "ver el panel completo",
  ver_pantalla_hoy: "ver la pantalla Hoy",
  ver_clases: "ver clases",
  gestionar_clases: "gestionar clases",
  ver_nutricion: "ver planes de nutrición",
  gestionar_nutricion: "gestionar planes de nutrición",
};
