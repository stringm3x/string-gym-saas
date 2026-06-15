import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
          {icon}
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="max-w-sm text-xs text-text-secondary">{description}</p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
