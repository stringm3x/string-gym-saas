"use client";

import { LuPrinter } from "react-icons/lu";
import { Button } from "@/components/ui/Button";

export function ReciboPrintButton() {
  return (
    <div className="flex justify-end print:hidden">
      <Button
        leftIcon={<LuPrinter className="h-4 w-4" />}
        onClick={() => window.print()}
        size="sm"
      >
        Imprimir / Descargar
      </Button>
    </div>
  );
}
