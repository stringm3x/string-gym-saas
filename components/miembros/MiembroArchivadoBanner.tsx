"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArchive, LuRotateCcw } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatFecha } from "@/lib/utils/format";
import { restaurarMiembroAction } from "@/app/(tenant)/[slug]/miembros/actions";

interface MiembroArchivadoBannerProps {
  miembroId: string;
  archivadoAt: string | null;
}

export function MiembroArchivadoBanner({
  miembroId,
  archivadoAt,
}: MiembroArchivadoBannerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleRestaurar() {
    startTransition(async () => {
      const result = await restaurarMiembroAction(miembroId);
      if (!result.ok) {
        toastError("Error", result.error ?? "No se pudo restaurar.");
        return;
      }
      success("Miembro restaurado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <LuArchive className="h-4 w-4 shrink-0 text-warning" />
        <p className="text-sm text-text-primary">
          Este miembro está archivado
          {archivadoAt ? ` desde el ${formatFecha(archivadoAt)}` : ""}.
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<LuRotateCcw className="h-3.5 w-3.5" />}
        onClick={handleRestaurar}
        loading={isPending}
      >
        Restaurar miembro
      </Button>
    </div>
  );
}
