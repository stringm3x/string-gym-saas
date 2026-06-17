import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFeature, type Plan } from "@/lib/features";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: gym } = await supabase
    .from("gyms")
    .select("slug, plan")
    .eq("owner_id", session.user.id)
    .eq("estado", "activo")
    .single();

  if (!gym) {
    redirect("/login");
  }

  const destino = hasFeature(gym.plan as Plan, "pantalla_hoy")
    ? "hoy"
    : "dashboard";
  redirect(`/${gym.slug}/${destino}`);
}
