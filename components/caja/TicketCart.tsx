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
      <div className="space-y-1.5">
        <Label>Agregar producto</Label>
        <div className="flex gap-2">
          <select
            value={prodSel}
            onChange={(e) => setProdSel(e.target.value)}
            className="flex-1 cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
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
            variant="ghost"
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
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lineas.map((l) => (
            <li
              key={l.producto_id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{l.nombre}</p>
                <p className="text-xs text-text-muted">
                  {formatMoneda(l.precio)} c/u
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.producto_id, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:text-text-primary"
                >
                  <LuMinus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm tabular-nums">
                  {l.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(l.producto_id, 1)}
                  disabled={l.cantidad >= l.stock}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40"
                >
                  <LuPlus className="h-3 w-3" />
                </button>
                <span className="w-16 text-right font-mono text-sm tabular-nums text-text-primary">
                  {formatMoneda(l.precio * l.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(l.producto_id)}
                  className="text-text-muted hover:text-danger"
                >
                  <LuTrash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Membresía opcional */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={conMembresia}
            onChange={(e) => setConMembresia(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
          Agregar membresía al ticket
        </label>

        {conMembresia && (
          <div className="space-y-2 pt-1">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            >
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatMoneda(p.precio)}
                </option>
              ))}
            </select>
            {miembro ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-text-primary">{miembro.nombre}</span>
                <button
                  type="button"
                  onClick={() => setMiembro(null)}
                  className="text-text-muted hover:text-danger"
                >
                  <LuX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <MiembroSearch onSelect={setMiembro} />
            )}
          </div>
        )}
      </div>

      {/* Método */}
      <div className="space-y-1.5">
        <Label>Método de pago</Label>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMetodo(m.value)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                metodo === m.value
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Total + cobro */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-muted">
            Total del ticket
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-brand-green">
            {formatMoneda(total)}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={cobrar}
          loading={isPending}
          disabled={!puedeCobrar}
        >
          Cobrar ticket
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
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar miembro…"
        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
      />
      {mostrar && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-text-muted">
              Sin coincidencias
            </p>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m)}
                    className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                  >
                    {m.nombre}
                    {m.telefono && (
                      <span className="ml-2 font-mono text-xs text-text-secondary">
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
