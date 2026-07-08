import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { KioscoShell } from "@/components/kiosco/KioscoShell";

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function KioscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id, nombre, logo_url, plan, color_acento")
    .eq("slug", slug)
    .maybeSingle();

  if (!gym) notFound();

  if (!hasFeature(gym.plan as Plan, "qr_access")) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          {gym.nombre}
        </h1>
        <p className="max-w-md text-lg text-text-secondary">
          El kiosco de auto check-in está disponible en el Plan Pro.
        </p>
      </div>
    );
  }

  // Marca el kiosco con el color del gym (sobre el token brand-green).
  const accent = typeof gym.color_acento === "string" && HEX.test(gym.color_acento)
    ? gym.color_acento
    : null;

  return (
    <>
      {accent && (
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--color-brand-green:${accent}}`,
          }}
        />
      )}
      <KioscoShell
        slug={slug}
        gymNombre={gym.nombre}
        logoUrl={gym.logo_url}
        canAutoservicio={hasFeature(gym.plan as Plan, "kiosco_autoservicio")}
      />
    </>
  );
}
