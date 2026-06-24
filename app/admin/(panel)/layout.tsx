import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Gate del panel admin: requiere sesión Supabase válida + presencia en
 * `string_admins` activo. Funciona en cualquier host (no depende del
 * middleware). El login (/admin/login) queda FUERA de este layout.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
