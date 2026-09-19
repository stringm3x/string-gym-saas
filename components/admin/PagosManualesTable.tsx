"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { registrarPagoManualAction } from "@/app/admin/(panel)/tenants/[tenantId]/actions";
import type { TenantPagoManual } from "@/lib/queries/admin.queries";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

// Campo crudo del sistema: 44px, radio de 4px, fondo bg.
const FIELD =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
const TH = "px-4 py-3 font-normal";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function PagosManualesTable({
  tenantId,
  pagos,
}: {
  tenantId: string;
  pagos: TenantPagoManual[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [concepto, setConcepto] = useState("mensualidad");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [fecha, setFecha] = useState(hoy());
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");

  function submit() {
    setErr(null);
    start(async () => {
      const r = await registrarPagoManualAction(tenantId, {
        concepto,
        monto: Number(monto),
        metodo,
        fecha_pago: fecha,
        referencia: referencia || undefined,
        notas: notas || undefined,
      });
      if (r.ok) {
        setMonto("");
        setReferencia("");
        setNotas("");
        setOpen(false);
        router.refresh();
      } else {
        setErr(r.error ?? "Error");
      }
    });
  }

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Pagos manuales
        </h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Cerrar" : "Registrar pago"}
        </Button>
      </div>

      {open && (
        <div className="space-y-4 border-b border-border p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pago-concepto">Concepto</Label>
              <select
                id="pago-concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className={FIELD}
              >
                <option value="mensualidad">Mensualidad</option>
                <option value="anualidad">Anualidad</option>
                <option value="setup">Setup</option>
                <option value="migracion">Migración</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pago-metodo">Método</Label>
              <select
                id="pago-metodo"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className={FIELD}
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="deposito">Depósito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pago-monto">Monto</Label>
              <input
                id="pago-monto"
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className={`${FIELD} font-mono tabular-nums`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pago-fecha">Fecha</Label>
              <input
                id="pago-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`${FIELD} font-mono tabular-nums`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pago-referencia">Referencia</Label>
              <input
                id="pago-referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Opcional"
                className={FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pago-notas">Notas</Label>
              <input
                id="pago-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                className={FIELD}
              />
            </div>
          </div>
          {err && (
            <p role="alert" className="text-sm text-danger">
              {err}
            </p>
          )}
          <Button
            type="button"
            disabled={!monto}
            loading={pending}
            onClick={submit}
          >
            {pending ? "Guardando…" : "Guardar pago"}
          </Button>
        </div>
      )}

      {pagos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-secondary">
          Sin pagos registrados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-etiqueta uppercase text-text-muted">
                <th className={TH}>Fecha</th>
                <th className={TH}>Concepto</th>
                <th className={TH}>Método</th>
                <th className={TH}>Ref.</th>
                <th className={`${TH} text-right`}>Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-dato tabular-nums text-text-secondary">
                    {p.fecha_pago}
                  </td>
                  <td className="px-4 py-3 capitalize text-text-primary">
                    {p.concepto}
                  </td>
                  <td className="px-4 py-3 capitalize text-text-secondary">
                    {p.metodo}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {p.referencia ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-dato tabular-nums text-text-primary">
                    {MXN.format(p.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
