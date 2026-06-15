import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { MiembroForm } from "@/components/miembros/MiembroForm";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NuevoMiembroPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/${slug}/miembros`}
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Volver a miembros
        </Link>

        <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-text-primary">
          Nuevo miembro
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Registra los datos básicos. Podrás registrar pagos y check-ins desde
          su ficha.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <MiembroForm mode="create" slug={slug} />
      </div>
    </div>
  );
}
