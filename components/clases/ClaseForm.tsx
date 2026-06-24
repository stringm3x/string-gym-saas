"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COLORES_CLASE, claseInputSchema } from "@/lib/validations/clases.schema";
import {
  createClaseAction,
  updateClaseAction,
} from "@/app/(tenant)/[slug]/configuracion/clases/actions";
import type { Clase } from "@/lib/types/clases";

const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
const LABEL = "block text-xs font-medium text-text-secondary mb-1";

// Días en orden de visualización (lunes → domingo) con su valor 0-6.
const DIAS = [
  { n: 1, l: "Lun" },
  { n: 2, l: "Mar" },
  { n: 3, l: "Mié" },
  { n: 4, l: "Jue" },
  { n: 5, l: "Vie" },
  { n: 6, l: "Sáb" },
  { n: 0, l: "Dom" },
];

interface Props {
  mode: "create" | "edit";
  initial?: Clase;
  onDone: () => void;
}

export function ClaseForm({ mode, initial, onDone }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [tipo, setTipo] = useState(initial?.tipo ?? "regular");
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORES_CLASE[0]);
  const [duracion, setDuracion] = useState(
    String(initial?.duracion_minutos ?? 60)
  );
  const [cupo, setCupo] = useState(String(initial?.cupo_maximo ?? 15));
  const [esRecurrente, setEsRecurrente] = useState(
    initial?.es_recurrente ?? true
  );
  const [dias, setDias] = useState<number[]>(initial?.dias_semana ?? []);
  const [horaInicio, setHoraInicio] = useState(
    (initial?.hora_inicio ?? "07:00").slice(0, 5)
  );
  const [fechaInicio, setFechaInicio] = useState(
    initial?.fecha_inicio ?? new Date().toISOString().slice(0, 10)
  );
  const [fechaFin, setFechaFin] = useState(initial?.fecha_fin ?? "");

  function toggleDia(n: number) {
    setDias((prev) =>
      prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n]
    );
  }

  function submit() {
    setErrors({});
    setFormError(null);

    const values = {
      nombre,
      tipo,
      instructor,
      color,
      duracion_minutos: Number(duracion),
      cupo_maximo: Number(cupo),
      es_recurrente: esRecurrente,
      dias_semana: dias,
      hora_inicio: horaInicio,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };

    const parsed = claseInputSchema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }

    start(async () => {
      const result =
        mode === "create"
          ? await createClaseAction(values)
          : await updateClaseAction(initial!.id, values);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFormError(result.error ?? null);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL}>Nombre de la clase</label>
        <input
          className={INPUT}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Box Matutino"
        />
        {errors.nombre && (
          <p className="mt-1 text-xs text-danger">{errors.nombre}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Tipo</label>
          <select
            className={INPUT}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Clase["tipo"])}
          >
            <option value="regular">Regular</option>
            <option value="gratis">Gratis</option>
            <option value="taller">Taller</option>
            <option value="privada">Privada</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Instructor (opcional)</label>
          <input
            className={INPUT}
            value={instructor ?? ""}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="Nombre"
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>Color</label>
        <div className="flex gap-2">
          {COLORES_CLASE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`h-7 w-7 rounded-full transition-transform ${
                color === c
                  ? "ring-2 ring-offset-2 ring-offset-bg ring-text-primary scale-110"
                  : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Duración (minutos)</label>
          <input
            type="number"
            min={15}
            max={240}
            className={INPUT}
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
          />
          {errors.duracion_minutos && (
            <p className="mt-1 text-xs text-danger">{errors.duracion_minutos}</p>
          )}
        </div>
        <div>
          <label className={LABEL}>Cupo máximo</label>
          <input
            type="number"
            min={1}
            max={200}
            className={INPUT}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
          />
          {errors.cupo_maximo && (
            <p className="mt-1 text-xs text-danger">{errors.cupo_maximo}</p>
          )}
        </div>
      </div>

      {/* Recurrencia */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm text-text-primary">Clase recurrente</span>
          <input
            type="checkbox"
            checked={esRecurrente}
            onChange={(e) => setEsRecurrente(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
        </label>

        {esRecurrente ? (
          <div className="mt-3">
            <label className={LABEL}>Días de la semana</label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((d) => {
                const active = dias.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    onClick={() => toggleDia(d.n)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
            {errors.dias_semana && (
              <p className="mt-1 text-xs text-danger">{errors.dias_semana}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-muted">
            Clase única: se usa la fecha de inicio como fecha de la clase.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Hora de inicio</label>
          <input
            type="time"
            className={INPUT}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
          {errors.hora_inicio && (
            <p className="mt-1 text-xs text-danger">{errors.hora_inicio}</p>
          )}
        </div>
        <div>
          <label className={LABEL}>
            {esRecurrente ? "Fecha de inicio" : "Fecha de la clase"}
          </label>
          <input
            type="date"
            className={INPUT}
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
          {errors.fecha_inicio && (
            <p className="mt-1 text-xs text-danger">{errors.fecha_inicio}</p>
          )}
        </div>
      </div>

      {esRecurrente && (
        <div>
          <label className={LABEL}>Fecha de fin (opcional)</label>
          <input
            type="date"
            className={INPUT}
            value={fechaFin ?? ""}
            onChange={(e) => setFechaFin(e.target.value)}
          />
          {errors.fecha_fin && (
            <p className="mt-1 text-xs text-danger">{errors.fecha_fin}</p>
          )}
        </div>
      )}

      {formError && <p className="text-xs text-danger">{formError}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : mode === "create" ? "Crear clase" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
