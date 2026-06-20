"use client";

import { cn } from "@/lib/utils/cn";
import { Label } from "@/components/ui/Label";
import { HEX_REGEX } from "@/lib/validations/marca.schema";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
  disabled?: boolean;
}

export function ColorPicker({
  value,
  onChange,
  label,
  presetColors = [],
  disabled = false,
}: ColorPickerProps) {
  const valido = HEX_REGEX.test(value);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div className="flex items-center gap-2">
        <label
          className={cn(
            "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border",
            disabled && "opacity-50"
          )}
          style={{ backgroundColor: valido ? value : "transparent" }}
        >
          <input
            type="color"
            value={valido ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label ?? "Selector de color"}
          />
        </label>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#50ff05"
          maxLength={7}
          className={cn(
            "w-32 rounded-lg border bg-surface px-3 py-2 font-mono text-sm text-text-primary focus:outline-none disabled:opacity-50",
            valido
              ? "border-border focus:border-brand-green"
              : "border-danger focus:border-danger"
          )}
        />

        {presetColors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {presetColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                disabled={disabled}
                title={c}
                className={cn(
                  "h-6 w-6 rounded-md border transition-transform hover:scale-110 disabled:opacity-50",
                  value.toLowerCase() === c.toLowerCase()
                    ? "border-text-primary"
                    : "border-border"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      {!valido && (
        <p className="text-xs text-danger">Formato inválido. Usa #RRGGBB.</p>
      )}
    </div>
  );
}
