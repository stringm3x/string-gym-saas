"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { LuUpload, LuTrash2, LuLoaderCircle, LuImage } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Label } from "@/components/ui/Label";

interface FileUploadProps {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  description?: string;
}

export function FileUpload({
  currentUrl,
  onUpload,
  onDelete,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp",
  maxSizeMB = 2,
  label,
  description,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptedTypes = accept.split(",").map((t) => t.trim());

  function validar(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) {
      return "Tipo de archivo no permitido. Usa PNG, JPG, SVG o WEBP.";
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `El archivo supera el máximo de ${maxSizeMB}MB.`;
    }
    return null;
  }

  async function handleFile(file: File) {
    const validationError = validar(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy("upload");
    try {
      await onUpload(file);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setBusy("delete");
    try {
      await onDelete();
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}

      {currentUrl ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg bg-bg">
            <Image
              src={currentUrl}
              alt="Logo actual"
              fill
              sizes="128px"
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
            >
              {busy === "upload" ? (
                <LuLoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LuUpload className="h-3.5 w-3.5" />
              )}
              Reemplazar
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-40"
              >
                {busy === "delete" ? (
                  <LuLoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuTrash2 className="h-3.5 w-3.5" />
                )}
                Eliminar
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy !== null}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center transition-colors",
            dragging
              ? "border-brand-green bg-brand-green/5"
              : "border-border bg-surface hover:border-text-muted"
          )}
        >
          {busy === "upload" ? (
            <LuLoaderCircle className="h-6 w-6 animate-spin text-brand-green" />
          ) : (
            <LuImage className="h-6 w-6 text-text-muted" />
          )}
          <span className="text-sm font-medium text-text-primary">
            Arrastra tu logo aquí o haz clic para subir
          </span>
          {description && (
            <span className="text-xs text-text-muted">{description}</span>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
