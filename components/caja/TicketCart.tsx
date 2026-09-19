"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuMinus, LuTrash2, LuSearch, LuX } from "react-icons/lu";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";
import { registrarTicketAction } from "@/app/(tenant)/[slug]/caja/actions";
import type { ProductoConStock } from "@/lib/queries/productos.queries";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

type Metodo = "efectivo" | "tarjeta" | "transferencia";
const METODOS: { value: Metodo; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

interface MiembroLite {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
}

interface LineaProducto {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  stock: number;
}

interface TicketCartProps {
  slug: string;
  productos: ProductoConStock[];
  planes: PlanMembresia[];
}

export function TicketCart({ slug, productos, planes }: TicketCartProps) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [prodSel, setProdSel] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");

  // Membresía opcional.
  const [conMembresia, setConMembresia] = useState(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [miembro, setMiembro] = useState<MiembroLite | null>(null);

  function agregarProducto() {
    const p = productos.find((x) => x.id === prodSel);
    if (!p) return;
    setLineas((prev) => {
      const existe = prev.find((l) => l.producto_id === p.id);
      if (existe) {
        return prev.map((l) =>
          l.producto_id === p.id
            ? { ...l, cantidad: Math.min(l.cantidad + 1, l.stock) }
            : l
        );
      }
      return [
        ...prev,
        {
          producto_id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad: 1,
          stock: p.stock_actual,
        },
      ];
    });
    setProdSel("");
  }

  function cambiarCantidad(id: string, delta: number) {
    setLineas((prev) =>
      prev
        .map((l) =>
          l.producto_id === id
            ? {
                ...l,
                cantidad: Math.max(0, Math.min(l.cantidad + delta, l.stock)),
              }
            : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }

  function quitar(id: string) {
    setLineas((prev) => prev.filter((l) => l.producto_id !== id));
  }

  const planMem = planes.find((p) => p.id === planId) ?? null;
  const totalProductos = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const totalMembresia = conMembresia && planMem ? planMem.precio : 0;
  const total = totalProductos + totalMembresia;

  const puedeCobrar =
    total > 0 &&
    (!conMembresia || (!!planMem && !!miembro)) &&
    !isPending;

  function cobrar() {
    if (conMembresia && !miembro) {
      toastError("Falta el miembro", "Elige a quién se le cobra la membresía.");
      return;
    }
    startTransition(async () => {
      const r = await registrarTicketAction({
        metodo,
        miembroId: conMembresia ? (miembro?.id ?? null) : null,
        productos: lineas.map((l) => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
        })),
        membresia: conMembresia && planMem ? { plan_id: planMem.id } : null,
      });
      if (!r.ok) {
        toastError("No se pudo cobrar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      if (r.ticketId) router.push(`/${slug}/recibos/ticket/${r.ticketId}`);
      else router.refresh();
    });
  }

  const disponibles = productos.filter(
    (p) => p.stock_actual > 0 && !lineas.some((l) => l.producto_id === p.id && l.cantidad >= p.stock_actual)
  );

  return (
    <div className="space-y-4">
      {/* Agregar producto */}
      <div className="space-y-2">
        <Label htmlFor="ticket-producto">Producto</Label>
        <div className="flex gap-2">
          <select
            id="ticket-producto"
            value={prodSel}
            onChange={(e) => setProdSel(e.target.value)}
            className="h-11 min-w-0 flex-1 cursor-pointer rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          >
            <option value="">Selecciona un producto…</option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {formatMoneda(p.precio)} ({p.stock_actual} en stock)
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={agregarProducto}
            disabled={!prodSel}
            leftIcon={<LuPlus className="h-4 w-4" />}
          >
            Agregar
          </Button>
        </div>
      </div>

      {/* Líneas del ticket */}
      {lineas.length > 0 && (
        <ul className="divide-y divide-border border border-border bg-bg">
          {lineas.map((l) => (
            <li
              key={l.producto_id}
              className="flex items-center justify-between gap-3 py-1 pl-4 pr-1"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-5 text-text-primary">
                  {l.nombre}
                </p>
                <p className="text-sm text-text-muted">
                  <span className="font-mono">{formatMoneda(l.precio)}</span> c/u
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.producto_id, -1)}
                  aria-label={`Quitar uno de ${l.nombre}`}
                  className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
                >
                  <LuMinus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-mono text-dato tabular-nums text-text-primary">
                  {l.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.producto_id, 1)}
                  disabled={l.cantidad >= l.stock}
                  aria-label={`Agregar uno de ${l.nombre}`}
                  className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LuPlus className="h-4 w-4" />
                </button>
                <span className="w-20 text-right font-mono text-dato tabular-nums text-text-primary">
                  {formatMoneda(l.precio * l.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(l.producto_id)}
                  aria-label={`Quitar ${l.nombre} del ticket`}
                  className="flex h-11 w-11 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
                >
                  <LuTrash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Membresía opcional */}
      <div className="border border-border bg-bg p-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-text-primary">
          <input
            type="checkbox"
            checked={conMembresia}
            onChange={(e) => setConMembresia(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-green"
          />
          Agregar membresía al ticket
        </label>

        {conMembresia && (
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ticket-plan">Plan</Label>
              <select
                id="ticket-plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-11 w-full cursor-pointer rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
              >
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatMoneda(p.precio)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-miembro">Miembro</Label>
              {miembro ? (
                <div className="flex items-center justify-between gap-3 border border-border py-1 pl-4 pr-1">
                  <span className="truncate text-[15px] leading-5 text-text-primary">
                    {miembro.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMiembro(null)}
                    aria-label="Quitar miembro"
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <MiembroSearch onSelect={setMiembro} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Método */}
      <div className="space-y-2">
        <Label>Método</Label>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => {
            const active = metodo === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-11 items-center justify-center border px-2 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border bg-bg text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Total + cobro */}
      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <p className="font-mono text-etiqueta uppercase text-text-secondary">
          Total
        </p>
        <p className="font-mono text-[36px] font-bold leading-10 tabular-nums text-text-primary">
          {formatMoneda(total)}
        </p>
        <Button
          type="button"
          size="lg"
          onClick={cobrar}
          loading={isPending}
          disabled={!puedeCobrar}
          className="w-full"
        >
          Cobrar ticket · {formatMoneda(total)}
        </Button>
      </div>
    </div>
  );
}

function MiembroSearch({ onSelect }: { onSelect: (m: MiembroLite) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MiembroLite[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let activo = true;
    const t = window.setTimeout(async () => {
      try {
        const r = await searchMiembrosAction(term);
        if (activo) setResults(r as MiembroLite[]);
      } catch {
        if (activo) setResults([]);
      }
    }, 250);
    return () => {
      activo = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const mostrar = useMemo(() => q.trim().length >= 2, [q]);

  return (
    <div className="relative">
      <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input
        id="ticket-miembro"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar miembro…"
        autoComplete="off"
        className="h-11 w-full rounded border border-border bg-bg pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
      />
      {mostrar && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden border border-border bg-surface">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-text-muted">
              Sin coincidencias
            </p>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m)}
                    className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate text-[15px] leading-5 text-text-primary">
                      {m.nombre}
                    </span>
                    {m.telefono && (
                      <span className="shrink-0 font-mono text-dato text-text-muted">
                        {m.telefono}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
