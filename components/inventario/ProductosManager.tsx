"use client";

import { useActionState, useEffect, useState } from "react";
import {
  LuPencil,
  LuPlus,
  LuPackage,
  LuSearch,
  LuTriangleAlert,
  LuArrowUpDown,
} from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ProductoConStock } from "@/lib/queries/productos.queries";
import {
  createProductoAction,
  updateProductoAction,
  registerMovimientoAction,
  type ProductoFormState,
  type MovimientoFormState,
} from "@/app/(tenant)/[slug]/inventario/actions";

interface ProductosManagerProps {
  productos: ProductoConStock[];
}

const emptyProd: ProductoFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};
const emptyMov: MovimientoFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

type Modal =
  | { kind: "create-producto" }
  | { kind: "edit-producto"; producto: ProductoConStock }
  | { kind: "ajuste"; producto: ProductoConStock }
  | null;

export function ProductosManager({ productos }: ProductosManagerProps) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal>(null);

  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const stockBajo = productos.filter((p) => p.stock_bajo).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>
            {productos.length === 0
              ? "Sin productos"
              : `${productos.length} ${
                  productos.length === 1 ? "producto" : "productos"
                }`}
          </span>
          {stockBajo > 0 && (
            <Badge variant="danger">{stockBajo} con stock bajo</Badge>
          )}
        </div>

        <div className="flex gap-2">
          <div className="w-56">
            <Input
              type="search"
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSlot={<LuSearch className="h-4 w-4" />}
              aria-label="Buscar productos"
            />
          </div>
          <Button
            leftIcon={<LuPlus className="h-4 w-4" />}
            onClick={() => setModal({ kind: "create-producto" })}
          >
            Nuevo producto
          </Button>
        </div>
      </div>

      {productos.length === 0 ? (
        <EmptyState
          icon={<LuPackage className="h-5 w-5" />}
          title="Aún no hay productos"
          description="Da de alta los productos que vendes en mostrador (proteínas, ropa, accesorios). Podrás controlar su stock y venderlos desde Caja."
          action={
            <Button
              leftIcon={<LuPlus className="h-4 w-4" />}
              onClick={() => setModal({ kind: "create-producto" })}
            >
              Crear primer producto
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LuSearch className="h-5 w-5" />}
          title="Sin resultados"
          description={`No hay productos que coincidan con "${search}".`}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th>Precio</Th>
                <Th>Stock</Th>
                <Th>Vendidos</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-hover">
                  <Td>
                    <p className="text-sm font-medium text-text-primary">
                      {p.nombre}
                    </p>
                  </Td>
                  <Td>
                    <span className="text-xs text-text-secondary">
                      {p.categoria ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm tabular-nums text-text-primary">
                      {formatMoneda(p.precio)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          p.stock_bajo ? "text-danger" : "text-text-primary"
                        )}
                      >
                        {p.stock_actual}
                      </span>
                      {p.stock_bajo && (
                        <LuTriangleAlert className="h-3.5 w-3.5 text-danger" />
                      )}
                      {p.stock_minimo > 0 && (
                        <span className="text-xs text-text-muted">
                          mín {p.stock_minimo}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-text-secondary tabular-nums">
                      {p.unidades_vendidas}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<LuArrowUpDown className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setModal({ kind: "ajuste", producto: p })
                        }
                      >
                        Ajustar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${p.nombre}`}
                        onClick={() =>
                          setModal({ kind: "edit-producto", producto: p })
                        }
                      >
                        <LuPencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductoFormModal modal={modal} onClose={() => setModal(null)} />
      <AjusteModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}

// ============================================================
// Modal de producto (crear/editar)
// ============================================================

function ProductoFormModal({
  modal,
  onClose,
}: {
  modal: Modal;
  onClose: () => void;
}) {
  const { success } = useToast();
  const isOpen =
    modal?.kind === "create-producto" || modal?.kind === "edit-producto";
  const producto = modal?.kind === "edit-producto" ? modal.producto : undefined;
  const isEdit = modal?.kind === "edit-producto";

  const action = isEdit
    ? updateProductoAction.bind(null, modal.producto.id)
    : createProductoAction;

  const [state, formAction, isPending] = useActionState(action, emptyProd);

  useEffect(() => {
    if (state.ok) {
      success(isEdit ? "Producto actualizado" : "Producto creado");
      onClose();
    }
  }, [state, isEdit, success, onClose]);

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      description="El stock inicial se registra como movimiento de entrada en el log."
      size="lg"
    >
      <form action={formAction} className="space-y-4">
        <Input
          label="Nombre"
          name="nombre"
          required
          defaultValue={producto?.nombre}
          placeholder="Ej. Proteína Whey 2kg"
          error={state.fieldErrors.nombre}
        />

        <Input
          label="Categoría"
          name="categoria"
          defaultValue={producto?.categoria ?? ""}
          placeholder="Suplementos, ropa, accesorios…"
          error={state.fieldErrors.categoria}
          description="Opcional"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio venta"
            name="precio"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            required
            leftSlot="$"
            defaultValue={producto?.precio}
            error={state.fieldErrors.precio}
          />
          <Input
            label="Costo (opcional)"
            name="costo"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            leftSlot="$"
            defaultValue={producto?.costo ?? ""}
            error={state.fieldErrors.costo}
            description="Para calcular margen"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <Input
              label="Stock inicial"
              name="stock_inicial"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              defaultValue={0}
              error={state.fieldErrors.stock_inicial}
              description="Unidades disponibles ahora"
            />
          )}
          <Input
            label="Stock mínimo"
            name="stock_minimo"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={producto?.stock_minimo ?? 0}
            error={state.fieldErrors.stock_minimo}
            description="Alerta cuando bajes de este"
          />
        </div>

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? "Guardar" : "Crear producto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Modal de ajuste de stock
// ============================================================

function AjusteModal({
  modal,
  onClose,
}: {
  modal: Modal;
  onClose: () => void;
}) {
  const { success } = useToast();
  const isOpen = modal?.kind === "ajuste";
  const producto = modal?.kind === "ajuste" ? modal.producto : undefined;

  const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [state, formAction, isPending] = useActionState(
    registerMovimientoAction,
    emptyMov
  );

  useEffect(() => {
    if (state.ok) {
      success("Movimiento registrado");
      onClose();
    }
  }, [state, success, onClose]);

  useEffect(() => {
    if (isOpen) setTipo("entrada");
  }, [isOpen]);

  if (!isOpen || !producto) return null;

  const tipos: {
    value: "entrada" | "salida" | "ajuste";
    label: string;
    help: string;
  }[] = [
    { value: "entrada", label: "Entrada", help: "Suma al stock" },
    { value: "salida", label: "Salida", help: "Resta del stock" },
    { value: "ajuste", label: "Ajuste", help: "Suma o resta según signo" },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Ajustar stock"
      description={`${producto.nombre} · Stock actual: ${producto.stock_actual}`}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="producto_id" value={producto.id} />
        <input type="hidden" name="tipo" value={tipo} />

        <div className="space-y-2">
          <Label>Tipo de movimiento</Label>
          <div className="grid grid-cols-3 gap-2">
            {tipos.map((t) => {
              const active = tipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                    active
                      ? "border-brand-green bg-brand-green/10"
                      : "border-border bg-surface hover:border-text-muted"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-brand-green" : "text-text-primary"
                    )}
                  >
                    {t.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">{t.help}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Cantidad"
          name="cantidad"
          type="number"
          inputMode="numeric"
          step="1"
          required
          placeholder={
            tipo === "ajuste" ? "Usa signo negativo para restar" : "1"
          }
          error={state.fieldErrors.cantidad}
          description={
            tipo === "ajuste"
              ? "Ej: -3 para restar 3, 5 para sumar 5"
              : "Unidades a " + (tipo === "entrada" ? "agregar" : "descontar")
          }
        />

        <Input
          label="Motivo"
          name="motivo"
          placeholder={
            tipo === "entrada"
              ? "Compra al proveedor, donación…"
              : tipo === "salida"
              ? "Producto dañado, merma…"
              : "Corrección de inventario físico"
          }
          error={state.fieldErrors.motivo}
          description="Opcional, pero recomendado para auditoría"
        />

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Registrar movimiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
