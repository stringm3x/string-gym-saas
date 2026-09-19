"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuUpload,
  LuDownload,
  LuFileSpreadsheet,
  LuLoaderCircle,
  LuCircleCheck,
} from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { CSVPreviewTable } from "./CSVPreviewTable";
import { ImportErrorsList } from "./ImportErrorsList";
import {
  parsearCSVAction,
  importarMiembrosAction,
} from "@/app/(tenant)/[slug]/miembros/importar/actions";
import type { ImportPreview, ImportResult } from "@/lib/types/import";

interface WizardProps {
  slug: string;
  planesNombres: string[];
}

export function ImportarMiembrosWizard({ slug, planesNombres }: WizardProps) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toastError("Archivo inválido", "Debe ser un archivo .csv");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toastError("Archivo muy grande", "Máximo 5MB.");
      return;
    }
    setFile(f);
  }

  async function analizar() {
    if (!file) return;
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await parsearCSVAction(fd);
    setParsing(false);
    if (!res.ok) {
      toastError("No se pudo leer el CSV", res.error);
      return;
    }
    setPreview(res.preview);
    setStep(2);
  }

  async function importar() {
    if (!preview) return;
    setImporting(true);
    setStep(3);
    const res = await importarMiembrosAction(preview.validRows.map((r) => r.data));
    setImporting(false);
    setResult(res);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep(1);
  }

  const sinPlan = preview
    ? preview.validRows.filter((r) => r.plan.status !== "ok").length
    : 0;

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {/* PASO 1 — Subir */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Sube un archivo CSV con tus miembros. Usa la plantilla para
              asegurar el formato correcto.
            </p>
            <a
              href={`/api/${slug}/plantilla-miembros`}
              download
              className="inline-flex h-9 shrink-0 items-center gap-2 border border-border px-3 text-sm text-text-primary transition-colors hover:border-text-secondary"
            >
              <LuDownload className="h-4 w-4" aria-hidden="true" />
              Descargar plantilla
            </a>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 border border-dashed py-12 text-center transition-colors",
              dragging
                ? "border-brand-green bg-surface-hover"
                : "border-border bg-bg hover:border-text-secondary"
            )}
          >
            {file ? (
              <>
                <LuFileSpreadsheet
                  className="h-7 w-7 text-brand-green"
                  aria-hidden="true"
                />
                <span className="text-[15px] leading-5 text-text-primary">
                  {file.name}
                </span>
                <span className="text-sm text-text-muted">
                  <span className="font-mono">{(file.size / 1024).toFixed(0)} KB</span>{" "}
                  · clic para cambiar
                </span>
              </>
            ) : (
              <>
                <LuUpload className="h-7 w-7 text-text-muted" aria-hidden="true" />
                <span className="text-[15px] leading-5 text-text-primary">
                  Arrastra tu CSV aquí o haz clic para subir
                </span>
                <span className="text-sm text-text-muted">
                  UTF-8, separado por comas. Máximo 5 MB.
                </span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Archivo CSV"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {planesNombres.length > 0 && (
            <p className="text-sm text-text-muted">
              Planes disponibles para la columna «plan»:{" "}
              <span className="text-text-secondary">
                {planesNombres.join(", ")}
              </span>
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={analizar} disabled={!file} loading={parsing}>
              Analizar archivo
            </Button>
          </div>
        </div>
      )}

      {/* PASO 2 — Preview */}
      {step === 2 && preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Válidos" value={preview.validRows.length} accent />
            <Stat label="Con error" value={preview.invalidRows.length} />
            <Stat label="Dup. en CSV" value={preview.duplicatesInCSV} />
            <Stat label="Ya en BD" value={preview.duplicatesInDB} />
            <Stat label="Sin plan" value={sinPlan} />
          </div>

          {preview.plansNotFound.length > 0 && (
            <div className="border border-warning/40 px-4 py-3 text-sm">
              <span className="text-text-primary">Planes no encontrados:</span>{" "}
              <span className="text-text-secondary">
                {preview.plansNotFound.join(", ")}
              </span>
              <p className="mt-0.5 text-sm text-text-muted">
                Esos miembros se importarán sin plan asignado.
              </p>
            </div>
          )}

          <CSVPreviewTable rows={preview.validRows} />

          <ImportErrorsList errors={preview.invalidRows} />

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="secondary" onClick={reset}>
              Volver
            </Button>
            <Button
              onClick={importar}
              disabled={preview.validRows.length === 0}
            >
              Importar {preview.validRows.length} miembro
              {preview.validRows.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* PASO 3 — Resultado */}
      {step === 3 && (
        <div className="space-y-5">
          {importing || !result ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <LuLoaderCircle className="h-8 w-8 animate-spin text-brand-green" />
              <p className="text-sm text-text-secondary">
                Importando miembros…
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <LuCircleCheck
                  className="h-10 w-10 text-brand-green"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-pagina font-semibold text-text-primary">
                    Importación completa
                  </p>
                  <p className="mt-1 font-mono text-dato text-text-secondary">
                    {result.successCount} importados · {result.sinPlanCount} sin
                    plan · {result.failedCount} fallaron
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <ImportErrorsList errors={result.errors} />
              )}

              <div className="flex items-center justify-center gap-3 border-t border-border pt-5">
                <Button variant="secondary" onClick={reset}>
                  Importar otro CSV
                </Button>
                <Link
                  href={`/${slug}/miembros?origen=csv`}
                  className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
                >
                  Ver miembros importados
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Pasos del asistente: número en círculo (badge numérico), etiqueta mono. */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Subir archivo", "Revisar", "Resultado"];
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <li
            key={label}
            className="flex items-center gap-3"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs font-bold",
                active
                  ? "border-brand-green bg-brand-green text-on-brand"
                  : done
                    ? "border-brand-green text-brand-green"
                    : "border-border text-text-muted"
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "font-mono text-etiqueta uppercase",
                active ? "text-text-primary" : "text-text-muted"
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span className="h-px w-6 bg-border" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Cifra del resumen: etiqueta en mono arriba, número en mono 26px. */
function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-bg p-4">
      <p className="font-mono text-etiqueta uppercase text-text-secondary">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-[26px] font-bold leading-8 tabular-nums",
          accent ? "text-brand-green" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}
