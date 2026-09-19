"use client";

import { useId, useState, useTransition } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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

const TEXTAREA =
  "w-full rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

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

/** Formulario del plan: etiquetas en mono, inputs de 44px, chips de
 * objetivo con borde, comidas como filas con botón de quitar de 44px. */
export function PlanNutricionForm({ miembroId, plan, onDone, onCancel }: Props) {
  const id = useId();
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
      className="flex flex-col gap-5 border border-border bg-bg p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Título del plan"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Plan de definición — Julio"
          maxLength={120}
          required
        />
        <Input
          label="Calorías objetivo (opcional)"
          type="number"
          inputMode="numeric"
          min={0}
          max={20000}
          value={calorias}
          onChange={(e) => setCalorias(e.target.value)}
          placeholder="2200"
          className="font-mono tabular-nums"
        />
      </div>

      <div className="space-y-2">
        <Input
          label="Objetivo (opcional)"
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Bajar de peso"
          maxLength={200}
        />
        <div className="flex flex-wrap gap-2">
          {OBJETIVOS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setObjetivo(o)}
              aria-pressed={objetivo === o}
              className={
                objetivo === o
                  ? "inline-flex h-9 items-center border border-brand-green bg-surface-hover px-3 text-sm text-brand-green"
                  : "inline-flex h-9 items-center border border-border px-3 text-sm text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
              }
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Comidas</Label>
        <div className="flex flex-col gap-2">
          {comidas.map((c, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 border border-border bg-surface p-3 sm:flex-row sm:items-start"
            >
              <input
                value={c.tiempo}
                onChange={(e) => setComida(i, "tiempo", e.target.value)}
                placeholder="Desayuno"
                list={`${id}-tiempos`}
                maxLength={60}
                aria-label={`Tiempo de la comida ${i + 1}`}
                className="h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none sm:w-40"
              />
              <textarea
                value={c.alimentos}
                onChange={(e) => setComida(i, "alimentos", e.target.value)}
                placeholder="3 huevos, 40 g de avena, 1 fruta…"
                rows={2}
                aria-label={`Alimentos de la comida ${i + 1}`}
                className={`${TEXTAREA} flex-1 resize-y`}
              />
              <button
                type="button"
                onClick={() => quitarComida(i)}
                aria-label={`Quitar comida ${i + 1}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center self-end text-text-muted transition-colors hover:bg-surface-hover hover:text-danger sm:self-start"
              >
                <LuTrash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <datalist id={`${id}-tiempos`}>
          {TIEMPOS_SUGERIDOS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={agregarComida}
          leftIcon={<LuPlus className="h-4 w-4" />}
        >
          Agregar comida
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-notas`}>Notas (opcional)</Label>
        <textarea
          id={`${id}-notas`}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Tomar 3 L de agua al día, evitar azúcar…"
          rows={2}
          maxLength={2000}
          className={`${TEXTAREA} resize-y`}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {plan ? "Guardar cambios" : "Crear plan"}
        </Button>
      </div>
    </form>
  );
}
