import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-green text-bg hover:bg-brand-green/90 active:bg-brand-green/80 disabled:bg-brand-green/40 disabled:text-bg/60",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-surface-hover hover:border-text-muted active:bg-surface disabled:opacity-40",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary active:bg-surface-hover disabled:opacity-40",
  danger:
    "bg-danger text-text-primary hover:bg-danger/90 active:bg-danger/80 disabled:opacity-40",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green",
          "disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            <span>{children}</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="flex shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
