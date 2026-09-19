"use client";

import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import type { PlanPagoConCuotas } from "@/lib/types/creditos";
import { PlanPagoForm } from "./PlanPagoForm";
import { PlanPagoCard } from "./PlanPagoCard";

interface PlanMembresiaOpt {
  id: string;
  nombre: string;
  precio: number;
}

interface ProductoOpt {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

export function MiembroCreditos({
  miembroId,
  miembroNombre,
  planes,
  planesMembresia,
  productos,
}: {
  miembroId: string;
  miembroNombre: string;
  planes: PlanPagoConCuotas[];
  planesMembresia: PlanMembresiaOpt[];
  productos: ProductoOpt[];
}) {
  const [creando, setCreando] = useState(false);
  const sinCatalogo = planesMembresia.length === 0 && productos.length === 0;

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Pagos a plazos
        </h3>
        {!creando && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreando(true)}
            disabled={sinCatalogo}
            leftIcon={<LuPlus className="h-4 w-4" />}
            title={
              sinCatalogo
                ? "Crea un plan de membresía o un producto primero"
                : undefined
            }
          >
            Crear plan de pagos
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {creando && (
          <PlanPagoForm
            miembroId={miembroId}
            planesMembresia={planesMembresia}
            productos={productos}
            onDone={() => setCreando(false)}
          />
        )}

        {planes.length === 0 && !creando ? (
          <div className="border border-border bg-bg px-5 py-8 text-center">
            <p className="text-sm text-text-muted">
              Este miembro no tiene planes de pago a plazos.
            </p>
            {sinCatalogo && (
              <p className="mt-1 text-sm text-text-muted">
                Crea primero un plan de membresía o un producto para poder
                ofrecer pagos a plazos.
              </p>
            )}
          </div>
        ) : (
          planes.map((p) => (
            <PlanPagoCard key={p.id} plan={p} miembroNombre={miembroNombre} />
          ))
        )}
      </div>
    </section>
  );
}
