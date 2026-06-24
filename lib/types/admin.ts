/** Roles internos de STRING (no confundir con StaffRol de los gyms). */
export type AdminRole = "super_admin" | "admin";

/** Fila de `string_admins`. */
export interface StringAdmin {
  user_id: string;
  email: string;
  nombre: string | null;
  role: AdminRole;
  activo: boolean;
  created_at: string;
  ultimo_acceso: string | null;
}

/** Fila de `admin_events` (audit log append-only). */
export interface AdminEvent {
  id: string;
  admin_user_id: string;
  admin_email: string;
  accion: string;
  target_tenant_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
