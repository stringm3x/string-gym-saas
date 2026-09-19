"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuLockOpen, LuLock, LuChevronDown, LuChevronUp } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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

const INPUT =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

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

/**
 * Tarjeta del turno (artboard "Caja"). Los totales por método los pinta la
 * página encima; aquí va el estado del turno, el desglose por tipo y el
 * cierre con conteo de efectivo.
 */
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
  // Con turno abierto y sin nada pendiente, no vale la pena ocupar espacio:
  // arranca colapsado en una barra resumen. Sin turno abierto sí se muestra
  // expandido: es una acción pendiente.
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
        aria-expanded={false}
        className="card-surface flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:border-text-secondary"
      >
        <span className="flex items-center gap-2 text-sm text-text-primary">
          <LuLockOpen className="h-4 w-4 text-brand-green" aria-hidden="true" />
          Turno abierto
          {totales && (
            <span className="font-mono text-dato tabular-nums text-text-secondary">
              · {formatMoneda(totales.total)}
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
          Ver corte
          <LuChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          {corte ? (
            <LuLockOpen className="h-4 w-4 text-brand-green" aria-hidden="true" />
          ) : (
            <LuLock className="h-4 w-4 text-text-muted" aria-hidden="true" />
          )}
          Corte de caja
        </h3>
        <div className="flex items-center gap-4">
          <Link
            href={`/${slug}/caja/cortes`}
            className="text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
          >
            Historial
          </Link>
          {corte && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded={true}
              className="inline-flex h-9 items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Ocultar
              <LuChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
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
    </section>
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
    <section className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Ventas de hoy · {nombreCaja}
        </h3>
        <span className="font-mono text-dato tabular-nums text-text-primary">
          {formatMoneda(t.total)}
        </span>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {totalesPorConcepto && (
          <DesglosePorConcepto totalesPorConcepto={totalesPorConcepto} />
        )}
        <p className="text-sm text-text-muted">
          Esta caja no cuadra efectivo por separado: solo categoriza ventas.
          Si algún día separas este dinero físicamente, actívalo en
          Configuración → Cajas.
        </p>
      </div>
    </section>
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
  const id = useId();
  return (
    <div className="space-y-2 border border-border bg-bg p-4">
      <Label htmlFor={`${id}-staff`}>¿Quién eres?</Label>
      <div className="flex gap-2">
        <select
          id={`${id}-staff`}
          value={staffId}
          onChange={(e) => onStaffChange(e.target.value)}
          className={cn(INPUT, "min-w-0 flex-1 cursor-pointer")}
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
          aria-label="PIN"
          className={cn(
            INPUT,
            "w-24 text-center font-mono tracking-[0.3em] placeholder:tracking-normal"
          )}
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        No hay ningún turno abierto. Abre uno con el efectivo con el que
        arrancas el cajón.
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
        <label className="flex-1 space-y-2">
          <span className="block font-mono text-etiqueta uppercase text-text-secondary">
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
            className={cn(INPUT, "font-mono tabular-nums")}
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
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dato label="Abrió" valor={corte.abierto_por_nombre ?? "—"} />
        <Dato label="Hora" valor={hora(corte.abierto_at)} mono />
        <Dato label="Fondo inicial" valor={formatMoneda(corte.fondo_inicial)} mono />
        <Dato
          label="Total turno"
          valor={`${formatMoneda(t.total)} · ${t.cantidad}`}
          mono
        />
      </dl>

      {totalesPorConcepto && (
        <DesglosePorConcepto totalesPorConcepto={totalesPorConcepto} />
      )}

      {/* Cierre */}
      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <ul className="divide-y divide-border border border-border">
          {t.reembolsosEfectivo > 0 && (
            <li className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-text-secondary">Reembolsos en efectivo</span>
              <span className="font-mono text-dato tabular-nums text-danger">
                −{formatMoneda(t.reembolsosEfectivo)}
              </span>
            </li>
          )}
          <li className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-text-secondary">Esperado en cajón</span>
            <span className="font-mono text-dato tabular-nums text-text-primary">
              {formatMoneda(esperado)}
            </span>
          </li>
        </ul>

        <label className="space-y-2">
          <span className="block font-mono text-etiqueta uppercase text-text-secondary">
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
            className={cn(INPUT, "font-mono tabular-nums")}
          />
        </label>

        {diferencia !== null && (
          <p
            className={cn(
              "flex items-center justify-between border px-4 py-3 text-sm",
              diferencia === 0
                ? "border-success/40 text-success"
                : diferencia < 0
                  ? "border-danger/40 text-danger"
                  : "border-warning/40 text-warning"
            )}
          >
            <span>
              {diferencia === 0
                ? "Cuadra exacto"
                : diferencia < 0
                  ? "Faltante"
                  : "Sobrante"}
            </span>
            <span className="font-mono text-dato tabular-nums">
              {formatMoneda(Math.abs(diferencia))}
            </span>
          </p>
        )}

        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Notas del cierre (opcional)…"
          aria-label="Notas del cierre"
          className="w-full resize-none rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
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
          variant="secondary"
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

function Dato({
  label,
  valor,
  mono = false,
}: {
  label: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-etiqueta uppercase text-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-text-primary",
          mono ? "font-mono text-dato tabular-nums" : "text-[15px] leading-5"
        )}
      >
        {valor}
      </dd>
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
      <p className="font-mono text-etiqueta uppercase text-text-muted">
        Por tipo
      </p>
      <ul className="divide-y divide-border border border-border">
        {conceptos.map((c) => (
          <li
            key={c}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span className="text-text-secondary">
              {CONCEPTO_LABELS[c]}
              <span className="ml-2 font-mono text-text-muted">
                ×{totalesPorConcepto[c].cantidad}
              </span>
            </span>
            <span className="font-mono text-dato tabular-nums text-text-primary">
              {formatMoneda(totalesPorConcepto[c].total)}
            </span>
          </li>
        ))}
        {totalesPorConcepto.producto.total > 0 && (
          <li
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            title="Venta de productos menos su costo. En ventas a plazos, el costo se cuenta el día que salió el producto del inventario, no el día de cada cuota — puede no coincidir con el turno exacto."
          >
            <span className="text-text-secondary">
              Ganancia de productos (estimada)
            </span>
            <span className="font-mono text-dato tabular-nums text-success">
              {formatMoneda(totalesPorConcepto.gananciaProductos)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
