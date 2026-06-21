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
  LuArrowLeft,
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Sube un archivo CSV con tus miembros. Usa la plantilla para
              asegurar el formato correcto.
            </p>
            <a
              href="/plantilla-miembros.csv"
              download
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              <LuDownload className="h-3.5 w-3.5" />
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
              "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center transition-colors",
              dragging
                ? "border-brand-green bg-brand-green/5"
                : "border-border bg-surface hover:border-text-muted"
            )}
          >
            {file ? (
              <>
                <LuFileSpreadsheet className="h-7 w-7 text-brand-green" />
                <span className="text-sm font-medium text-text-primary">
                  {file.name}
                </span>
                <span className="text-xs text-text-muted">
                  {(file.size / 1024).toFixed(0)} KB · clic para cambiar
                </span>
              </>
            ) : (
              <>
                <LuUpload className="h-7 w-7 text-text-muted" />
                <span className="text-sm font-medium text-text-primary">
                  Arrastra tu CSV aquí o haz clic para subir
                </span>
                <span className="text-xs text-text-muted">
                  UTF-8, separador coma. Máximo 5MB.
                </span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {planesNombres.length > 0 && (
            <p className="text-xs text-text-muted">
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
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              <span className="font-medium text-text-primary">
                Planes no encontrados:
              </span>{" "}
              <span className="text-text-secondary">
                {preview.plansNotFound.join(", ")}
              </span>
              <p className="mt-0.5 text-xs text-text-muted">
                Esos miembros se importarán sin plan asignado.
              </p>
            </div>
          )}

          <CSVPreviewTable rows={preview.validRows} />

          <ImportErrorsList errors={preview.invalidRows} />

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={reset}>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                  <LuCircleCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-display text-2xl uppercase tracking-wide text-text-primary">
                    Importación completa
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {result.successCount} importados · {result.sinPlanCount} sin
                    plan · {result.failedCount} fallaron
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <ImportErrorsList errors={result.errors} />
              )}

              <div className="flex items-center justify-center gap-2 border-t border-border pt-5">
                <Button variant="ghost" onClick={reset}>
                  Importar otro CSV
                </Button>
                <Link href={`/${slug}/miembros?origen=csv`}>
                  <Button leftIcon={<LuArrowLeft className="h-4 w-4" />}>
                    Ver miembros importados
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Subir archivo", "Revisar", "Resultado"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                active
                  ? "bg-brand-green text-bg"
                  : done
                    ? "bg-brand-green/20 text-brand-green"
                    : "bg-surface text-text-muted"
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-text-primary" : "text-text-muted"
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p
        className={cn(
          "font-mono text-xl font-bold tabular-nums",
          accent ? "text-brand-green" : "text-text-primary"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
