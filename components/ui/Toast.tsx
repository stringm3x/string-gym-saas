"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LuCircleCheck, LuCircleAlert, LuInfo, LuX } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...input, id }]);
      window.setTimeout(() => remove(id), TOAST_DURATION_MS);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ variant: "success", title, description }),
      error: (title, description) =>
        toast({ variant: "error", title, description }),
      info: (title, description) =>
        toast({ variant: "info", title, description }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

const variantConfig: Record<ToastVariant, { icon: ReactNode; ring: string }> = {
  success: {
    icon: <LuCircleCheck className="h-5 w-5 text-brand-green" />,
    ring: "ring-brand-green/30",
  },
  error: {
    icon: <LuCircleAlert className="h-5 w-5 text-danger" />,
    ring: "ring-danger/30",
  },
  info: {
    icon: <LuInfo className="h-5 w-5 text-gold" />,
    ring: "ring-gold/30",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const cfg = variantConfig[toast.variant];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg ring-1",
        "transition-all duration-200 ease-out",
        enter ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        cfg.ring
      )}
    >
      <div className="mt-0.5 shrink-0">{cfg.icon}</div>

      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-text-secondary">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}
