import type { StaffRol, Permission } from "./types/staff";

const PERMISSIONS_BY_ROLE: Record<StaffRol, Permission[]> = {
  owner: [
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
  ],
  receptionist: [
    "ver_checkins_dia",
    "crear_miembros",
    "editar_miembros",
    "registrar_pagos",
    "ver_historial_pagos_dia",
    "hacer_checkin_manual",
    "ver_inventario_stock",
    "vender_desde_caja",
  ],
};

export function hasPermission(rol: StaffRol, permission: Permission): boolean {
  return PERMISSIONS_BY_ROLE[rol]?.includes(permission) ?? false;
}

export function getPermissions(rol: StaffRol): Permission[] {
  return PERMISSIONS_BY_ROLE[rol] ?? [];
}
