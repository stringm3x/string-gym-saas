"use client";

import { useRouter } from "next/navigation";
import { LuPrinter, LuArrowLeft } from "react-icons/lu";
import { Button } from "@/components/ui/Button";

export function ReciboActions() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between print:hidden">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <LuArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>
      <Button
        leftIcon={<LuPrinter className="h-4 w-4" />}
        onClick={() => window.print()}
        size="sm"
      >
        Imprimir
      </Button>
    </div>
  );
}
