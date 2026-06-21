"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuUserPlus,
  LuWallet,
  LuCreditCard,
  LuArrowLeftRight,
} from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import {
  registrarVisitaRapidaAction,
  type PagoResult,
} from "@/app/(tenant)/[slug]/caja/actions";

type Metodo = "efectivo" | "tarjeta" | "transferencia";

const metodoOptions: { value: Metodo; label: string; icon: React.ReactNode }[] =
  [
    { value: "efectivo", label: "Efectivo", icon: <LuWallet className="h-4 w-4" /> },
    { value: "tarjeta", label: "Tarjeta", icon: <LuCreditCard className="h-4 w-4" /> },
    {
      value: "transferencia",
      label: "Transferencia",
      icon: <LuArrowLeftRight className="h-4 w-4" />,
    },
  ];

const initial: PagoResult = { ok: false, error: null, fieldErrors: {} };

export function VisitaRapidaButton() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [state, formAction, isPending] = useActionState(
    registrarVisitaRapidaAction,
    initial
  );

  useEffect(() => {
    if (state.ok) {
      success("Visita registrada");
      setOpen(false);
      setMetodo("efectivo");
      router.refresh();
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("No se pudo registrar", state.error);
    }
  }, [state]);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<LuUserPlus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Visita rápida
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Visita rápida">
        <form action={formAction} className="space-y-4">
          <p className="rounded-lg border border-border/60 bg-surface-hover px-3 py-2 text-xs text-text-muted">
            Cobra a un visitante sin registrarlo como miembro ni prospecto.
          </p>

          <Input
            label="Nombre del visitante"
            name="nombre_visitante"
            required
            placeholder="Ej. Juan Pérez"
            error={state.fieldErrors.nombre_visitante}
            autoFocus
          />

          <Input
            label="Teléfono (opcional)"
            name="telefono_visitante"
            type="tel"
            placeholder="55 1234 5678"
            error={state.fieldErrors.telefono_visitante}
          />

          <Input
            label="Monto"
            name="monto"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            required
            leftSlot="$"
            error={state.fieldErrors.monto}
          />

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-3 gap-2">
              {metodoOptions.map((opt) => {
                const active = metodo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMetodo(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors duration-150",
                      active
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border bg-surface text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="metodo_pago" value={metodo} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Registrar visita
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
