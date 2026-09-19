"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { COLORES_CLASE, claseInputSchema } from "@/lib/validations/clases.schema";
import {
  createClaseAction,
  updateClaseAction,
} from "@/app/(tenant)/[slug]/configuracion/clases/actions";
import type { Clase } from "@/lib/types/clases";

const INPUT =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
const LABEL = "mb-2 block font-mono text-etiqueta uppercase text-text-secondary";

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
        <label htmlFor="clase-nombre" className={LABEL}>Nombre de la clase</label>
        <input
          id="clase-nombre"
          className={INPUT}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Box Matutino"
        />
        {errors.nombre && (
          <p className="mt-1 text-sm text-danger">{errors.nombre}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="clase-tipo" className={LABEL}>Tipo</label>
          <select
            id="clase-tipo"
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
          <label htmlFor="clase-instructor" className={LABEL}>Instructor (opcional)</label>
          <input
            id="clase-instructor"
            className={INPUT}
            value={instructor ?? ""}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="Nombre"
          />
        </div>
      </div>

      <div>
        <span className={LABEL}>Color</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
          {COLORES_CLASE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                className={`block h-7 w-7 rounded-full ${
                  color === c
                    ? "ring-2 ring-text-primary ring-offset-2 ring-offset-surface"
                    : ""
                }`}
                style={{ backgroundColor: c }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="clase-duracion" className={LABEL}>Duración (minutos)</label>
          <input
            id="clase-duracion"
            type="number"
            min={15}
            max={240}
            className={INPUT}
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
          />
          {errors.duracion_minutos && (
            <p className="mt-1 text-sm text-danger">{errors.duracion_minutos}</p>
          )}
        </div>
        <div>
          <label htmlFor="clase-cupo" className={LABEL}>Cupo máximo</label>
          <input
            id="clase-cupo"
            type="number"
            min={1}
            max={200}
            className={INPUT}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
          />
          {errors.cupo_maximo && (
            <p className="mt-1 text-sm text-danger">{errors.cupo_maximo}</p>
          )}
        </div>
      </div>

      {/* Recurrencia */}
      <div className="border border-border bg-bg p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-text-primary">
            Clase recurrente
          </span>
          <input
            type="checkbox"
            checked={esRecurrente}
            onChange={(e) => setEsRecurrente(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-green"
          />
        </label>

        {esRecurrente ? (
          <div className="mt-3">
            <span className={LABEL}>Días de la semana</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
              {DIAS.map((d) => {
                const active = dias.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    onClick={() => toggleDia(d.n)}
                    aria-pressed={active}
                    className={`inline-flex h-9 items-center border px-3 text-sm transition-colors ${
                      active
                        ? "border-brand-green bg-surface-hover text-brand-green"
                        : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
            {errors.dias_semana && (
              <p className="mt-1 text-sm text-danger">{errors.dias_semana}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            Clase única: se usa la fecha de inicio como fecha de la clase.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="clase-hora" className={LABEL}>Hora de inicio</label>
          <input
            id="clase-hora"
            type="time"
            className={INPUT}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
          {errors.hora_inicio && (
            <p className="mt-1 text-sm text-danger">{errors.hora_inicio}</p>
          )}
        </div>
        <div>
          <label htmlFor="clase-fecha-inicio" className={LABEL}>
            {esRecurrente ? "Fecha de inicio" : "Fecha de la clase"}
          </label>
          <input
            id="clase-fecha-inicio"
            type="date"
            className={INPUT}
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
          {errors.fecha_inicio && (
            <p className="mt-1 text-sm text-danger">{errors.fecha_inicio}</p>
          )}
        </div>
      </div>

      {esRecurrente && (
        <div>
          <label htmlFor="clase-fecha-fin" className={LABEL}>Fecha de fin (opcional)</label>
          <input
            id="clase-fecha-fin"
            type="date"
            className={INPUT}
            value={fechaFin ?? ""}
            onChange={(e) => setFechaFin(e.target.value)}
          />
          {errors.fecha_fin && (
            <p className="mt-1 text-sm text-danger">{errors.fecha_fin}</p>
          )}
        </div>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="button" loading={pending} onClick={submit}>
          {mode === "create" ? "Crear clase" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
