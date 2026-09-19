"use client";

import { useRouter } from "next/navigation";
import { LuPrinter, LuArrowLeft } from "react-icons/lu";
import { Button } from "@/components/ui/Button";

// "Imprimir" es window.print(): desde ahí se imprime o se guarda como PDF.
export function ReciboActions() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between print:hidden">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex h-11 items-center gap-1.5 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
      >
        <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver
      </button>
      <Button
        leftIcon={<LuPrinter className="h-4 w-4" />}
        onClick={() => window.print()}
      >
        Imprimir
      </Button>
    </div>
  );
}
