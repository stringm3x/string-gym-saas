"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ADDONS_CATALOG } from "@/lib/addons";
import type { TenantDetail, TenantAddon } from "@/lib/queries/admin.queries";
import { Button } from "@/components/ui/Button";
import {
  cambiarPlanAction,
  marcarFundadorAction,
  suspenderTenantAction,
  reactivarTenantAction,
  activarPlanPagadoAction,
  cancelarTenantAction,
  extenderPruebaAction,
  toggleAddonAction,
  resetPasswordOwnerAction,
  type ActionResult,
} from "@/app/admin/(panel)/tenants/[tenantId]/actions";

// Campo crudo del sistema: 44px, radio de 4px, fondo bg.
const FIELD =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
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
  const [planActivar, setPlanActivar] = useState(tenant.plan);
  const [motivoActivar, setMotivoActivar] = useState("");
  const [suspMotivo, setSuspMotivo] = useState("");
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [dias, setDias] = useState(14);

  function run(fn: () => Promise<ActionResult>, okText = "Hecho") {
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
          role="status"
          className={`border px-4 py-3 text-sm ${
            msg.ok
              ? "border-brand-green/40 bg-brand-green/10 text-brand-green"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Plan */}
      <Card title="Plan">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            aria-label="Plan"
            className={`${FIELD} max-w-[140px]`}
          >
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="escala">Escala</option>
          </select>
          <input
            value={planMotivo}
            onChange={(e) => setPlanMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo del cambio de plan"
            className={`${FIELD} min-w-[160px] flex-1`}
          />
          <Button
            type="button"
            disabled={pending || plan === tenant.plan}
            onClick={() =>
              run(() => cambiarPlanAction(tenant.id, { plan, motivo: planMotivo }))
            }
          >
            Cambiar plan
          </Button>
        </div>
      </Card>

      {/* Cliente fundador */}
      <Card title="Cliente fundador">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">
            {tenant.es_fundador
              ? "Marcado como fundador."
              : "No es cliente fundador."}
          </p>
          <Button
            type="button"
            variant={tenant.es_fundador ? "secondary" : "primary"}
            disabled={pending}
            onClick={() =>
              run(() => marcarFundadorAction(tenant.id, !tenant.es_fundador))
            }
          >
            {tenant.es_fundador ? "Quitar fundador" : "Marcar fundador"}
          </Button>
        </div>
      </Card>

      {/* Convertir a plan pagado */}
      {tenant.estado === "prueba" && (
        <Card title="Convertir a plan pagado">
          <p className="mb-4 text-sm text-text-secondary">
            Este gimnasio está en prueba
            {tenant.prueba_hasta && (
              <>
                {" "}
                hasta{" "}
                <span className="font-mono tabular-nums text-text-primary">
                  {new Date(tenant.prueba_hasta).toLocaleDateString("es-MX")}
                </span>
              </>
            )}
            . Actívalo con un plan pagado para que deje de estar en prueba.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planActivar}
              onChange={(e) => setPlanActivar(e.target.value)}
              aria-label="Plan a activar"
              className={`${FIELD} max-w-[140px]`}
            >
              <option value="basico">Básico</option>
              <option value="pro">Pro</option>
              <option value="escala">Escala</option>
            </select>
            <input
              value={motivoActivar}
              onChange={(e) => setMotivoActivar(e.target.value)}
              placeholder="Motivo (opcional)"
              aria-label="Motivo de la activación"
              className={`${FIELD} min-w-[160px] flex-1`}
            />
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `¿Activar este gimnasio con el plan ${planActivar}? Dejará de estar en prueba.`
                  )
                )
                  return;
                run(
                  () =>
                    activarPlanPagadoAction(tenant.id, {
                      plan: planActivar,
                      motivo: motivoActivar,
                    }),
                  "Gimnasio activado con plan pagado"
                );
              }}
            >
              Activar plan pagado
            </Button>
          </div>
        </Card>
      )}

      {/* Estado */}
      <Card title="Estado del gimnasio">
        <p className="mb-4 text-sm text-text-secondary">
          Estado actual: <span className="capitalize text-text-primary">{tenant.estado}</span>
          {tenant.suspension_motivo && (
            <span className="text-text-muted"> — {tenant.suspension_motivo}</span>
          )}
        </p>

        {tenant.estado === "prueba" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              aria-label="Días a extender"
              className={`${FIELD} max-w-[90px] font-mono tabular-nums`}
            />
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => extenderPruebaAction(tenant.id, dias))}
            >
              Extender prueba
            </Button>
          </div>
        )}

        {(tenant.estado === "suspendido" || tenant.estado === "cancelado") && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => reactivarTenantAction(tenant.id))}
            className="mb-4"
          >
            Reactivar gimnasio
          </Button>
        )}

        {(tenant.estado === "activo" || tenant.estado === "prueba") && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={suspMotivo}
                onChange={(e) => setSuspMotivo(e.target.value)}
                placeholder="Motivo de suspensión"
                aria-label="Motivo de suspensión"
                className={`${FIELD} min-w-[160px] flex-1`}
              />
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm("¿Suspender este gimnasio? El dueño perderá acceso."))
                    return;
                  run(() => suspenderTenantAction(tenant.id, suspMotivo));
                }}
              >
                Suspender
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Motivo de cancelación"
                aria-label="Motivo de cancelación"
                className={`${FIELD} min-w-[160px] flex-1`}
              />
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm("¿Cancelar definitivamente este gimnasio?")) return;
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
              >
                Cancelar gimnasio
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Complementos: el catálogo está vacío a propósito; no se muestra vacío */}
      {ADDONS_CATALOG.length > 0 && (
        <Card title="Complementos">
          <ul className="divide-y divide-border border border-border">
            {ADDONS_CATALOG.map((def) => {
              const activo = activeAddonIds.has(def.id);
              return (
                <li
                  key={def.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {def.nombre}
                    </p>
                    <p className="text-xs text-text-muted">
                      <span className="font-mono tabular-nums">
                        ${def.precio}/mes
                      </span>{" "}
                      · {activo ? "activo" : "inactivo"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={activo ? "secondary" : "primary"}
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => toggleAddonAction(tenant.id, def.id, !activo))
                    }
                  >
                    {activo ? "Desactivar" : "Activar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Contraseña del dueño */}
      <Card title="Dueño">
        <div className="flex items-center justify-between gap-4">
          <p className="truncate text-sm text-text-secondary">
            {tenant.owner_email ?? "—"}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Enviar correo de recuperación de contraseña al dueño?"))
                return;
              run(
                () => resetPasswordOwnerAction(tenant.id),
                "Correo de recuperación enviado"
              );
            }}
          >
            Restablecer contraseña
          </Button>
        </div>
      </Card>
    </div>
  );
}
