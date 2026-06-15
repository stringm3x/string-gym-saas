import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";
import { Label } from "./Label";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      error,
      leftSlot,
      rightSlot,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedById = description ? `${inputId}-desc` : undefined;
    const errorId = error ? `${inputId}-err` : undefined;
    const ariaDescribedBy =
      [describedById, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}

        <div
          className={cn(
            "flex items-center rounded-lg border bg-surface transition-colors duration-150",
            error
              ? "border-danger/60 focus-within:border-danger"
              : "border-border focus-within:border-brand-green",
            props.disabled && "opacity-50"
          )}
        >
          {leftSlot && (
            <span className="pl-3 text-text-muted" aria-hidden="true">
              {leftSlot}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full bg-transparent px-3 py-2.5 text-sm text-text-primary",
              "placeholder:text-text-muted",
              "focus:outline-none",
              leftSlot && "pl-2",
              rightSlot && "pr-2",
              className
            )}
            {...props}
          />

          {rightSlot && (
            <span className="pr-3 text-text-muted" aria-hidden="true">
              {rightSlot}
            </span>
          )}
        </div>

        {description && !error && (
          <p id={describedById} className="text-xs text-text-muted">
            {description}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
