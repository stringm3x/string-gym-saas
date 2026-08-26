"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LuLockOpen,
  LuLock,
  LuHistory,
  LuChevronDown,
  LuChevronUp,
} from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { TZ_MX } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type {
  CorteAbierto,
  CorteTotales,
  CorteTotalesPorConcepto,
} from "@/lib/queries/cortes.queries";
import type { StaffParaCheckin } from "@/lib/queries/staff.queries";
import {
  abrirCorteAction,
  cerrarCorteAction,
} from "@/app/(tenant)/[slug]/caja/corte-actions";

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

interface CortePanelProps {
  slug: string;
  cajaId: string;
  nombreCaja: string;
  /** Si esta caja cuadra su propio efectivo — si no, solo categoriza ventas
   * y no tiene turnos que abrir/cerrar (ver Configuración → Cajas). */
  requiereCuadre: boolean;
  corte: CorteAbierto | null;
  totales: CorteTotales | null;
  totalesPorConcepto: CorteTotalesPorConcepto | null;
  /** Si el gym activó "Pedir PIN al abrir/cerrar turno" en Configuración → Staff. */
  checkinRequerido: boolean;
  staffParaCheckin: StaffParaCheckin[];
}

export function CortePanel({
  slug,
  cajaId,
  nombreCaja,
  requiereCuadre,
  corte,
  totales,
  totalesPorConcepto,
  checkinRequerido,
  staffParaCheckin,
}: CortePanelProps) {
  // Con turno abierto y sin nada pendiente, no vale la pena ocupar toda la
  // parte superior de la página — arranca colapsado en una barra resumen.
  // Sin turno abierto sí se muestra expandido: es una acción pendiente.
  const [expanded, setExpanded] = useState(!corte);

  if (!requiereCuadre) {
    return (
      <VentasSinCuadre
        nombreCaja={nombreCaja}
        totales={totales}
        totalesPorConcepto={totalesPorConcepto}
      />
    );
  }

  if (corte && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3 text-left transition-colors hover:border-brand-green/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <LuLockOpen className="h-4 w-4 text-brand-green" />
          Turno abierto
          {totales && (
            <span className="text-text-secondary">
              · {formatMoneda(totales.total)} cobrado
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          Ver corte
          <LuChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {corte ? (
            <LuLockOpen className="h-4 w-4 text-brand-green" />
          ) : (
            <LuLock className="h-4 w-4 text-text-muted" />
          )}
          Corte de caja
        </h3>
        <div className="flex items-center gap-3">
          {corte && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-brand-green"
            >
              <LuChevronUp className="h-3.5 w-3.5" /> Colapsar
            </button>
          )}
          <Link
            href={`/${slug}/caja/cortes`}
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-brand-green"
          >
            <LuHistory className="h-3.5 w-3.5" /> Historial
          </Link>
        </div>
      </div>

      {corte ? (
        <CorteAbiertoView
          corte={corte}
          totales={totales}
          totalesPorConcepto={totalesPorConcepto}
          checkinRequerido={checkinRequerido}
          staffParaCheckin={staffParaCheckin}
        />
      ) : (
        <AbrirCorte
          cajaId={cajaId}
          checkinRequerido={checkinRequerido}
          staffParaCheckin={staffParaCheckin}
        />
      )}
    </div>
  );
}

/** Vista de una caja que no cuadra efectivo por separado — solo un reporte
 * de ventas de hoy, sin fondo inicial ni conteo (no hay turno que abrir). */
function VentasSinCuadre({
  nombreCaja,
  totales,
  totalesPorConcepto,
}: {
  nombreCaja: string;
  totales: CorteTotales | null;
  totalesPorConcepto: CorteTotalesPorConcepto | null;
}) {
  const t = totales ?? {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    cantidad: 0,
    reembolsosEfectivo: 0,
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        Ventas de hoy · {nombreCaja}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tot label="Efectivo" valor={t.efectivo} acento />
        <Tot label="Tarjeta" valor={t.tarjeta} />
        <Tot label="Transferencia" valor={t.transferencia} />
        <Tot label="Total" valor={t.total} />
      </div>
      {totalesPorConcepto && (
        <div className="mt-4">
          <DesglosePorConcepto totalesPorConcepto={totalesPorConcepto} />
        </div>
      )}
      <p className="mt-4 text-[11px] text-text-muted">
        Esta caja no cuadra efectivo por separado — solo categoriza ventas.
        Si algún día separas este dinero físicamente, actívalo en
        Configuración → Cajas.
      </p>
    </div>
  );
}

/** Selector "¿Quién eres?" — solo aparece si el gym exige check-in por PIN. */
function CheckinPicker({
  staff,
  staffId,
  pin,
  onStaffChange,
  onPinChange,
}: {
  staff: StaffParaCheckin[];
  staffId: string;
  pin: string;
  onStaffChange: (id: string) => void;
  onPinChange: (pin: string) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-bg p-3">
      <p className="text-xs font-medium text-text-secondary">¿Quién eres?</p>
      <div className="flex gap-2">
        <select
          value={staffId}
          onChange={(e) => onStaffChange(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
        >
          <option value="">Selecciona tu nombre…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.tienePin}>
              {s.nombre}
              {!s.tienePin ? " (sin PIN)" : ""}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            onPinChange(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="PIN"
          className="w-20 rounded-lg border border-border bg-surface px-2 py-2 text-center font-mono text-sm tracking-widest text-text-primary placeholder:tracking-normal focus:border-brand-green focus:outline-none"
        />
      </div>
    </div>
  );
}

function AbrirCorte({
  cajaId,
  checkinRequerido,
  staffParaCheckin,
}: {
  cajaId: string;
  checkinRequerido: boolean;
  staffParaCheckin: StaffParaCheckin[];
}) {
  const router = useRouter();
  const { error: toastError, success } = useToast();
  const [fondo, setFondo] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();

  function abrir() {
    if (checkinRequerido && (!staffId || pin.length !== 4)) {
      toastError("Falta identificarte", "Elige tu nombre y escribe tu PIN.");
      return;
    }
    const monto = Number(fondo || 0);
    start(async () => {
      const r = await abrirCorteAction(
        cajaId,
        monto,
        checkinRequerido ? { staffId, pin } : undefined
      );
      if (!r.ok) {
        toastError("No se pudo abrir", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Turno abierto");
      setFondo("");
      setPin("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        No hay ningún turno abierto. Abre uno con el efectivo con el que arrancas
        el cajón.
      </p>
      {checkinRequerido && (
        <CheckinPicker
          staff={staffParaCheckin}
          staffId={staffId}
          pin={pin}
          onStaffChange={setStaffId}
          onPinChange={setPin}
        />
      )}
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
            Fondo inicial (efectivo)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
        </label>
        <Button type="button" onClick={abrir} loading={pending}>
          Abrir turno
        </Button>
      </div>
    </div>
  );
}

function CorteAbiertoView({
  corte,
  totales,
  totalesPorConcepto,
  checkinRequerido,
  staffParaCheckin,
}: {
  corte: CorteAbierto;
  totales: CorteTotales | null;
  totalesPorConcepto: CorteTotalesPorConcepto | null;
  checkinRequerido: boolean;
  staffParaCheckin: StaffParaCheckin[];
}) {
  const router = useRouter();
  const { error: toastError, success } = useToast();
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();

  const t = totales ?? {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    cantidad: 0,
    reembolsosEfectivo: 0,
  };
  const esperado = corte.fondo_inicial + t.efectivo - t.reembolsosEfectivo;
  const contadoNum = contado.trim() === "" ? null : Number(contado);
  const diferencia = contadoNum === null ? null : contadoNum - esperado;

  function cerrar() {
    if (contadoNum === null || !Number.isFinite(contadoNum)) {
      toastError("Falta el conteo", "Escribe el efectivo contado en el cajón.");
      return;
    }
    if (checkinRequerido && (!staffId || pin.length !== 4)) {
      toastError("Falta identificarte", "Elige tu nombre y escribe tu PIN.");
      return;
    }
    start(async () => {
      const r = await cerrarCorteAction(
        corte.id,
        contadoNum,
        notas,
        checkinRequerido ? { staffId, pin } : undefined
      );
      if (!r.ok) {
        toastError("No se pudo cerrar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success(
        "Turno cerrado",
        `Diferencia: ${formatMoneda(r.diferencia ?? 0)}`
      );
      setContado("");
      setNotas("");
      setPin("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Abierto por{" "}
        <span className="text-text-primary">
          {corte.abierto_por_nombre ?? "—"}
        </span>{" "}
        a las {hora(corte.abierto_at)} · Fondo inicial{" "}
        {formatMoneda(corte.fondo_inicial)}
      </p>

      {/* Totales del turno */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tot label="Efectivo" valor={t.efectivo} acento />
        <Tot label="Tarjeta" valor={t.tarjeta} />
        <Tot label="Transferencia" valor={t.transferencia} />
        <Tot label="Total turno" valor={t.total} />
      </div>

      {/* Desglose por tipo */}
      {totalesPorConcepto && (
        <DesglosePorConcepto totalesPorConcepto={totalesPorConcepto} />
      )}

      {/* Cierre */}
      <div className="space-y-3 border-t border-border pt-4">
        {t.reembolsosEfectivo > 0 && (
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Reembolsos en efectivo</span>
            <span className="font-mono text-danger">
              −{formatMoneda(t.reembolsosEfectivo)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Esperado en cajón</span>
          <span className="font-mono font-semibold text-text-primary">
            {formatMoneda(esperado)}
          </span>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
              Efectivo contado
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
          </label>
        </div>

        {diferencia !== null && (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              diferencia === 0
                ? "bg-success/10 text-success"
                : diferencia < 0
                  ? "bg-danger/10 text-danger"
                  : "bg-warning/10 text-warning"
            )}
          >
            <span>
              {diferencia === 0
                ? "Cuadra exacto"
                : diferencia < 0
                  ? "Faltante"
                  : "Sobrante"}
            </span>
            <span className="font-mono font-semibold">
              {formatMoneda(Math.abs(diferencia))}
            </span>
          </div>
        )}

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Notas del cierre (opcional)…"
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />

        {checkinRequerido && (
          <CheckinPicker
            staff={staffParaCheckin}
            staffId={staffId}
            pin={pin}
            onStaffChange={setStaffId}
            onPinChange={setPin}
          />
        )}

        <Button
          type="button"
          onClick={cerrar}
          loading={pending}
          className="w-full"
        >
          Cerrar turno
        </Button>
      </div>
    </div>
  );
}

function Tot({
  label,
  valor,
  acento = false,
}: {
  label: string;
  valor: number;
  acento?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          acento ? "text-brand-green" : "text-text-primary"
        )}
      >
        {formatMoneda(valor)}
      </p>
    </div>
  );
}

type ConceptoKey = "membresia" | "visita" | "producto" | "otro";

const CONCEPTO_LABELS: Record<ConceptoKey, string> = {
  membresia: "Membresías",
  visita: "Visitas",
  producto: "Productos",
  otro: "Otros",
};

function DesglosePorConcepto({
  totalesPorConcepto,
}: {
  totalesPorConcepto: CorteTotalesPorConcepto;
}) {
  const conceptos = (Object.keys(CONCEPTO_LABELS) as ConceptoKey[]).filter(
    (c) => totalesPorConcepto[c].total > 0
  );

  if (conceptos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Desglose por tipo
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {conceptos.map((c) => (
          <TotConcepto
            key={c}
            label={CONCEPTO_LABELS[c]}
            valor={totalesPorConcepto[c].total}
            cantidad={totalesPorConcepto[c].cantidad}
          />
        ))}
      </div>
      {totalesPorConcepto.producto.total > 0 && (
        <div
          className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-3 py-2"
          title="Venta de productos menos su costo. En ventas a plazos, el costo se cuenta el día que salió el producto del inventario, no el día de cada cuota — puede no coincidir con el turno exacto."
        >
          <span className="text-xs text-text-secondary">
            Ganancia de productos (estimada)
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-success">
            {formatMoneda(totalesPorConcepto.gananciaProductos)}
          </span>
        </div>
      )}
    </div>
  );
}

function TotConcepto({
  label,
  valor,
  cantidad,
}: {
  label: string;
  valor: number;
  cantidad: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-text-primary">
        {formatMoneda(valor)}{" "}
        <span className="text-[10px] font-normal text-text-muted">
          ({cantidad})
        </span>
      </p>
    </div>
  );
}
