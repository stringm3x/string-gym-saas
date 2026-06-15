import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("slug")
    .eq("owner_id", session.user.id)
    .eq("estado", "activo")
    .single();

  if (!gym) {
    redirect("/login");
  }

  redirect(`/${gym.slug}/dashboard`);
}
