export type StaffRol = "owner" | "receptionist" | "entrenador" | "gerente";
export type StaffEstado = "invitado" | "activo" | "desactivado";

export interface Staff {
  id: string;
  gym_id: string;
  user_id: string | null;
  email: string;
  nombre: string;
  rol: StaffRol;
  estado: StaffEstado;
  created_at: string;
  activado_at: string | null;
  desactivado_at: string | null;
  ultima_sesion_at: string | null;
}

export type Permission =
  | "ver_dashboard_ingresos"
  | "ver_checkins_dia"
  | "crear_miembros"
  | "editar_miembros"
  | "eliminar_archivar_miembros"
  | "registrar_pagos"
  | "cancelar_pagos"
  | "ver_historial_pagos_completo"
  | "ver_historial_pagos_dia"
  | "hacer_checkin_manual"
  | "ver_inventario_stock"
  | "ver_inventario_movimientos"
  | "vender_desde_caja"
  | "ver_prospectos"
  | "configurar_planes_promociones"
  | "gestionar_staff"
  | "configurar_general"
  | "ver_alertas"
  | "ver_dashboard_completo"
  | "ver_pantalla_hoy"
  | "ver_clases"
  | "gestionar_clases"
  | "ver_nutricion"
  | "gestionar_nutricion";
