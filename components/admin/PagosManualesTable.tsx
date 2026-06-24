"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarPagoManualAction } from "@/app/admin/(panel)/tenants/[tenantId]/actions";
import type { TenantPagoManual } from "@/lib/queries/admin.queries";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Pagos manuales
        </h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
        >
          {open ? "Cerrar" : "Registrar pago"}
        </button>
      </div>

      {open && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className={INPUT}
            >
              <option value="mensualidad">Mensualidad</option>
              <option value="anualidad">Anualidad</option>
              <option value="setup">Setup</option>
              <option value="migracion">Migración</option>
              <option value="otro">Otro</option>
            </select>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className={INPUT}
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="deposito">Depósito</option>
              <option value="otro">Otro</option>
            </select>
            <input
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              className={INPUT}
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={INPUT}
            />
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Referencia (opcional)"
              className={INPUT}
            />
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas (opcional)"
              className={INPUT}
            />
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <button
            type="button"
            disabled={pending || !monto}
            onClick={submit}
            className="rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar pago"}
          </button>
        </div>
      )}

      {pagos.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
          Sin pagos registrados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-left uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 font-medium">Método</th>
                <th className="px-3 py-2 font-medium">Ref.</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-text-secondary">
                    {p.fecha_pago}
                  </td>
                  <td className="px-3 py-2 capitalize text-text-primary">
                    {p.concepto}
                  </td>
                  <td className="px-3 py-2 capitalize text-text-secondary">
                    {p.metodo}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {p.referencia ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-primary">
                    {MXN.format(p.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
