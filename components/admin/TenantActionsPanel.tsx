"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ADDONS_CATALOG } from "@/lib/addons";
import type { TenantDetail, TenantAddon } from "@/lib/queries/admin.queries";
import {
  cambiarPlanAction,
  marcarFundadorAction,
  suspenderTenantAction,
  reactivarTenantAction,
  cancelarTenantAction,
  extenderPruebaAction,
  toggleAddonAction,
  resetPasswordOwnerAction,
  type ActionResult,
} from "@/app/admin/(panel)/tenants/[tenantId]/actions";

const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
const BTN =
  "rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST =
  "rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50";
const BTN_DANGER =
  "rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

export function TenantActionsPanel({
  tenant,
  addons,
}: {
  tenant: TenantDetail;
  addons: TenantAddon[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [plan, setPlan] = useState(tenant.plan);
  const [planMotivo, setPlanMotivo] = useState("");
  const [suspMotivo, setSuspMotivo] = useState("");
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [dias, setDias] = useState(14);

  function run(fn: () => Promise<ActionResult>, okText = "Hecho ✓") {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: okText });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "Error" });
      }
    });
  }

  const activeAddonIds = new Set(
    addons.filter((a) => a.estado === "activo").map((a) => a.addon_id)
  );

  return (
    <div className="space-y-4">
      {msg && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            msg.ok
              ? "border-brand-green/30 bg-brand-green/10 text-brand-green"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Plan */}
      <Card title="Plan">
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className={`${INPUT} max-w-[140px]`}
          >
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="escala">Escala</option>
          </select>
          <input
            value={planMotivo}
            onChange={(e) => setPlanMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            className={`${INPUT} flex-1 min-w-[160px]`}
          />
          <button
            type="button"
            disabled={pending || plan === tenant.plan}
            onClick={() =>
              run(() => cambiarPlanAction(tenant.id, { plan, motivo: planMotivo }))
            }
            className={BTN}
          >
            Cambiar plan
          </button>
        </div>
      </Card>

      {/* Cliente fundador */}
      <Card title="Cliente fundador">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-text-secondary">
            {tenant.es_fundador
              ? "Marcado como fundador."
              : "No es cliente fundador."}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => marcarFundadorAction(tenant.id, !tenant.es_fundador))
            }
            className={tenant.es_fundador ? BTN_GHOST : BTN}
          >
            {tenant.es_fundador ? "Quitar fundador" : "Marcar fundador"}
          </button>
        </div>
      </Card>

      {/* Estado */}
      <Card title="Estado del tenant">
        <p className="mb-3 text-xs text-text-secondary">
          Estado actual: <span className="capitalize">{tenant.estado}</span>
          {tenant.suspension_motivo && (
            <span className="text-text-muted"> — {tenant.suspension_motivo}</span>
          )}
        </p>

        {tenant.estado === "prueba" && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className={`${INPUT} max-w-[90px]`}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => extenderPruebaAction(tenant.id, dias))}
              className={BTN}
            >
              Extender prueba
            </button>
          </div>
        )}

        {(tenant.estado === "suspendido" || tenant.estado === "cancelado") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reactivarTenantAction(tenant.id))}
            className={`${BTN} mb-3`}
          >
            Reactivar tenant
          </button>
        )}

        {(tenant.estado === "activo" || tenant.estado === "prueba") && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <input
                value={suspMotivo}
                onChange={(e) => setSuspMotivo(e.target.value)}
                placeholder="Motivo de suspensión"
                className={`${INPUT} flex-1 min-w-[160px]`}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("¿Suspender este tenant? El owner perderá acceso."))
                    return;
                  run(() => suspenderTenantAction(tenant.id, suspMotivo));
                }}
                className={BTN_DANGER}
              >
                Suspender
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <input
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Motivo de cancelación"
                className={`${INPUT} flex-1 min-w-[160px]`}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("¿Cancelar definitivamente este tenant?")) return;
                  if (
                    !confirm(
                      "CONFIRMACIÓN FINAL: esta acción es irreversible. ¿Continuar?"
                    )
                  )
                    return;
                  run(() =>
                    cancelarTenantAction(tenant.id, {
                      motivo: cancelMotivo,
                      exportar: true,
                    })
                  );
                }}
                className={BTN_DANGER}
              >
                Cancelar tenant
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add-ons */}
      <Card title="Add-ons">
        <ul className="space-y-2">
          {ADDONS_CATALOG.map((def) => {
            const activo = activeAddonIds.has(def.id);
            return (
              <li
                key={def.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-text-primary">
                    {def.nombre}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    ${def.precio}/mes · {activo ? "activo" : "inactivo"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => toggleAddonAction(tenant.id, def.id, !activo))
                  }
                  className={activo ? BTN_GHOST : BTN}
                >
                  {activo ? "Desactivar" : "Activar"}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Reset password owner */}
      <Card title="Owner">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs text-text-secondary">
            {tenant.owner_email ?? "—"}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Enviar email de recuperación de contraseña al owner?"))
                return;
              run(
                () => resetPasswordOwnerAction(tenant.id),
                "Email de recuperación enviado ✓"
              );
            }}
            className={BTN_GHOST}
          >
            Resetear password
          </button>
        </div>
      </Card>
    </div>
  );
}
