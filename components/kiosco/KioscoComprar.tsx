"use client";

import { useState, useTransition } from "react";
import { LuMinus, LuPlus, LuArrowLeft } from "react-icons/lu";
import { KioscoScan } from "./KioscoScan";
import { CodigoAutorizacion } from "./CodigoAutorizacion";
import {
  identificarMiembroKioscoAction,
  crearCodigoCompraAction,
  type KioscoMetodo,
} from "@/app/kiosco/[slug]/actions";
import type { KioscoProducto } from "@/lib/queries/kiosco.queries";

type Paso = "scan" | "carrito" | "codigo";

const METODO_LABEL: Record<KioscoMetodo, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "MercadoPago",
};

function pesos(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function KioscoComprar({ slug }: { slug: string }) {
  const [paso, setPaso] = useState<Paso>("scan");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [miembro, setMiembro] = useState<{ id: string; nombre: string } | null>(
    null
  );
  const [productos, setProductos] = useState<KioscoProducto[]>([]);
  const [mpDisponible, setMpDisponible] = useState(false);
  const [cant, setCant] = useState<Record<string, number>>({});
  const [metodo, setMetodo] = useState<KioscoMetodo>("efectivo");
  const [codigo, setCodigo] = useState<{ codigo: string; expiraAt: string } | null>(
    null
  );

  const metodos: KioscoMetodo[] = mpDisponible
    ? ["efectivo", "transferencia", "mercadopago"]
    : ["efectivo", "transferencia"];

  const items = productos
    .filter((p) => (cant[p.id] ?? 0) > 0)
    .map((p) => ({ producto_id: p.id, cantidad: cant[p.id] }));
  const total = productos.reduce((s, p) => s + (cant[p.id] ?? 0) * p.precio, 0);

  function identificar(token: string) {
    setError(null);
    start(async () => {
      const r = await identificarMiembroKioscoAction(slug, token);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMiembro(r.miembro);
      setProductos(r.productos);
      setMpDisponible(r.mpDisponible);
      setCant({});
      setMetodo("efectivo");
      setPaso("carrito");
    });
  }

  function cambiar(id: string, delta: number, max: number) {
    setCant((prev) => {
      const n = Math.min(max, Math.max(0, (prev[id] ?? 0) + delta));
      const next = { ...prev };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  function generar() {
    if (items.length === 0 || !miembro) return;
    setError(null);
    start(async () => {
      const r = await crearCodigoCompraAction(slug, miembro.id, items, metodo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCodigo({ codigo: r.codigo, expiraAt: r.expiraAt });
      setPaso("codigo");
    });
  }

  function reset() {
    setPaso("scan");
    setMiembro(null);
    setProductos([]);
    setCant({});
    setCodigo(null);
    setError(null);
  }

  if (paso === "scan") {
    return (
      <KioscoScan
        titulo="Escanea tu QR para comprar"
        onToken={identificar}
        pending={pending}
        error={error}
      />
    );
  }

  if (paso === "codigo" && codigo) {
    return (
      <CodigoAutorizacion
        codigo={codigo.codigo}
        expiraAt={codigo.expiraAt}
        mensaje={`${miembro?.nombre}, muestra este código en el mostrador para que el staff autorice tu compra.`}
        onReset={reset}
      />
    );
  }

  // Carrito
  return (
    <div className="flex h-full min-h-0 w-full max-w-2xl flex-col gap-4 py-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <LuArrowLeft className="h-4 w-4" /> Cambiar miembro
        </button>
        <p className="text-lg font-semibold text-text-primary">
          Hola, {miembro?.nombre}
        </p>
      </div>

      {productos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-lg text-text-secondary">
          No hay productos disponibles en este momento.
        </p>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2 pr-1">
            {productos.map((p) => {
              const q = cant[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium text-text-primary">
                      {p.nombre}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {pesos(p.precio)} · {p.stock} disponibles
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => cambiar(p.id, -1, p.stock)}
                      disabled={q === 0}
                      aria-label="Quitar uno"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-text-primary transition-colors hover:border-brand-green disabled:opacity-30"
                    >
                      <LuMinus className="h-5 w-5" />
                    </button>
                    <span className="w-8 text-center text-2xl font-semibold text-text-primary">
                      {q}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiar(p.id, 1, p.stock)}
                      disabled={q >= p.stock}
                      aria-label="Agregar uno"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-text-primary transition-colors hover:border-brand-green disabled:opacity-30"
                    >
                      <LuPlus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer fijo: método + total + acción (siempre visible) */}
          <div className="shrink-0 space-y-3 border-t border-border pt-3">
            <div>
              <p className="mb-2 text-sm font-medium text-text-secondary">
                Método de pago
              </p>
              <div className="flex flex-wrap gap-2">
                {metodos.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodo(m)}
                    className={
                      "rounded-xl border px-5 py-2.5 text-base font-medium transition-colors " +
                      (metodo === m
                        ? "border-brand-green bg-brand-green/10 text-text-primary"
                        : "border-border text-text-secondary hover:text-text-primary")
                    }
                  >
                    {METODO_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-center text-base font-medium text-danger">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-text-secondary">Total</p>
                <p className="text-3xl font-bold text-text-primary">
                  {pesos(total)}
                </p>
              </div>
              <button
                type="button"
                onClick={generar}
                disabled={items.length === 0 || pending}
                className="rounded-2xl bg-brand-green px-8 py-4 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Generando…" : "Generar código"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
