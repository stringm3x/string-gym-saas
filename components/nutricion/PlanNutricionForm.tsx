"use client";

import { useState, useTransition } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ComidaNutricion, PlanNutricion } from "@/lib/queries/nutricion.queries";
import {
  crearPlanNutricionAction,
  editarPlanNutricionAction,
} from "@/app/(tenant)/[slug]/miembros/[id]/nutricion-actions";

const OBJETIVOS = [
  "Bajar de peso",
  "Ganar músculo",
  "Mantenimiento",
  "Recomposición",
];
const TIEMPOS_SUGERIDOS = ["Desayuno", "Snack AM", "Comida", "Snack PM", "Cena"];

function comidasIniciales(plan?: PlanNutricion): ComidaNutricion[] {
  if (plan && plan.comidas.length > 0) return plan.comidas;
  return [
    { tiempo: "Desayuno", alimentos: "" },
    { tiempo: "Comida", alimentos: "" },
    { tiempo: "Cena", alimentos: "" },
  ];
}

interface Props {
  miembroId: string;
  plan?: PlanNutricion;
  onDone: () => void;
  onCancel: () => void;
}

export function PlanNutricionForm({ miembroId, plan, onDone, onCancel }: Props) {
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();

  const [titulo, setTitulo] = useState(plan?.titulo ?? "");
  const [objetivo, setObjetivo] = useState(plan?.objetivo ?? "");
  const [calorias, setCalorias] = useState(
    plan?.calorias_objetivo != null ? String(plan.calorias_objetivo) : ""
  );
  const [comidas, setComidas] = useState<ComidaNutricion[]>(
    comidasIniciales(plan)
  );
  const [notas, setNotas] = useState(plan?.notas ?? "");

  function setComida(i: number, campo: keyof ComidaNutricion, valor: string) {
    setComidas((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c))
    );
  }

  function agregarComida() {
    setComidas((prev) => [...prev, { tiempo: "", alimentos: "" }]);
  }

  function quitarComida(i: number) {
    setComidas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim() === "") {
      toastError("Falta el título", "Ponle un nombre al plan.");
      return;
    }

    const input = {
      titulo: titulo.trim(),
      objetivo: objetivo.trim() || null,
      calorias_objetivo: calorias.trim() === "" ? null : Number(calorias),
      comidas: comidas
        .map((c) => ({ tiempo: c.tiempo.trim(), alimentos: c.alimentos.trim() }))
        .filter((c) => c.tiempo !== "" || c.alimentos !== ""),
      notas: notas.trim() || null,
    };

    start(async () => {
      const r = plan
        ? await editarPlanNutricionAction(miembroId, plan.id, input)
        : await crearPlanNutricionAction(miembroId, input);
      if (!r.ok) {
        toastError("No se pudo guardar", r.error ?? "Inténtalo de nuevo.");
        return;
      }
      success(plan ? "Plan actualizado" : "Plan creado");
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-border bg-bg p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary">
            Título del plan
          </span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Plan de definición — Julio"
            maxLength={120}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary">
            Calorías objetivo{" "}
            <span className="font-normal text-text-muted">(opcional)</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20000}
            value={calorias}
            onChange={(e) => setCalorias(e.target.value)}
            placeholder="2200"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
        </label>
      </div>

      <div className="text-sm">
        <span className="mb-1 block font-medium text-text-primary">
          Objetivo <span className="font-normal text-text-muted">(opcional)</span>
        </span>
        <input
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Bajar de peso"
          maxLength={200}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OBJETIVOS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setObjetivo(o)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-brand-green/40 hover:text-text-primary"
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-text-primary">
          Comidas
        </span>
        {comidas.map((c, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-start"
          >
            <input
              value={c.tiempo}
              onChange={(e) => setComida(i, "tiempo", e.target.value)}
              placeholder="Desayuno"
              list="tiempos-nutricion"
              maxLength={60}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none sm:w-40"
            />
            <textarea
              value={c.alimentos}
              onChange={(e) => setComida(i, "alimentos", e.target.value)}
              placeholder="3 huevos, 40g avena, 1 fruta…"
              rows={2}
              className="w-full flex-1 resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
            <button
              type="button"
              onClick={() => quitarComida(i)}
              aria-label="Quitar comida"
              className="self-end rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger sm:self-start"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <datalist id="tiempos-nutricion">
          {TIEMPOS_SUGERIDOS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={agregarComida}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-green transition-opacity hover:opacity-80"
        >
          <LuPlus className="h-3.5 w-3.5" /> Agregar comida
        </button>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-text-primary">
          Notas <span className="font-normal text-text-muted">(opcional)</span>
        </span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Tomar 3L de agua al día, evitar azúcar…"
          rows={2}
          maxLength={2000}
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {plan ? "Guardar cambios" : "Crear plan"}
        </Button>
      </div>
    </form>
  );
}
