"use client";

import { LuPrinter } from "react-icons/lu";
import { Button } from "@/components/ui/Button";

// Es window.print(): desde ahí se imprime o se guarda como PDF.
export function ReciboPrintButton() {
  return (
    <div className="flex justify-end print:hidden">
      <Button
        leftIcon={<LuPrinter className="h-4 w-4" />}
        onClick={() => window.print()}
      >
        Imprimir
      </Button>
    </div>
  );
}
