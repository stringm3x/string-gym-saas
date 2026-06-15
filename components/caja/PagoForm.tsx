"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  LuSearch,
  LuX,
  LuUser,
  LuWallet,
  LuCreditCard,
  LuArrowLeftRight,
} from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { formatFecha, formatMoneda } from "@/lib/utils/format";
import {
  calcularRangoMembresia,
  duracionPresets,
  type DuracionPreset,
} from "@/lib/utils/membresia-rango";
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";
import {
  registerPagoAction,
  type PagoResult,
} from "@/app/(tenant)/[slug]/caja/actions";

type Concepto = "membresia" | "visita" | "producto" | "otro";
type Metodo = "efectivo" | "tarjeta" | "transferencia";

interface MiembroLite {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
}

const initial: PagoResult = { ok: false, error: null, fieldErrors: {} };

const conceptoOptions: { value: Concepto; label: string }[] = [
  { value: "membresia", label: "Membresía" },
  { value: "visita", label: "Visita" },
  { value: "producto", label: "Producto" },
  { value: "otro", label: "Otro" },
];

const metodoOptions: { value: Metodo; label: string; icon: React.ReactNode }[] =
  [
    {
      value: "efectivo",
      label: "Efectivo",
      icon: <LuWallet className="h-4 w-4" />,
    },
    {
      value: "tarjeta",
      label: "Tarjeta",
      icon: <LuCreditCard className="h-4 w-4" />,
    },
    {
      value: "transferencia",
      label: "Transferencia",
      icon: <LuArrowLeftRight className="h-4 w-4" />,
    },
  ];

const presets: DuracionPreset[] = [
  "1_semana",
  "15_dias",
  "1_mes",
  "3_meses",
  "6_meses",
  "anual",
];

export function PagoForm() {
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    registerPagoAction,
    initial
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [concepto, setConcepto] = useState<Concepto>("membresia");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [miembro, setMiembro] = useState<MiembroLite | null>(null);
  const [preset, setPreset] = useState<DuracionPreset | "custom">("1_mes");
  const [periodoInicio, setPeriodoInicio] = useState<string>("");
  const [periodoFin, setPeriodoFin] = useState<string>("");

  const requiereMiembro = concepto === "membresia" || concepto === "visita";
  const requierePeriodo = concepto === "membresia";

  // Recalcular rango automáticamente cuando cambia preset o miembro.
  useEffect(() => {
    if (!requierePeriodo) {
      setPeriodoInicio("");
      setPeriodoFin("");
      return;
    }
    if (preset === "custom") return; // no tocar, el usuario los pone manual
    const rango = calcularRangoMembresia(preset, miembro?.fecha_vencimiento);
    setPeriodoInicio(rango.periodo_inicio);
    setPeriodoFin(rango.periodo_fin);
  }, [preset, miembro, requierePeriodo]);

  // Toast + reset on success
  useEffect(() => {
    if (state.ok) {
      success("Pago registrado");
      formRef.current?.reset();
      setMiembro(null);
      setConcepto("membresia");
      setMetodo("efectivo");
      setPreset("1_mes");
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("No se pudo registrar", state.error);
    }
  }, [state, success, toastError]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Concepto */}
      <div className="space-y-2">
        <Label>Concepto</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {conceptoOptions.map((opt) => {
            const active = concepto === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConcepto(opt.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="concepto" value={concepto} />
      </div>

      {/* Miembro */}
      {requiereMiembro && (
        <div className="space-y-2">
          <Label required>Miembro</Label>
          {miembro ? (
            <SelectedMiembroChip
              miembro={miembro}
              onClear={() => setMiembro(null)}
            />
          ) : (
            <MiembroAutocomplete onSelect={setMiembro} />
          )}
          <input type="hidden" name="miembro_id" value={miembro?.id ?? ""} />
          {state.fieldErrors.miembro_id && (
            <p role="alert" className="text-xs text-danger">
              {state.fieldErrors.miembro_id}
            </p>
          )}
        </div>
      )}

      {/* Periodo solo para membresía */}
      {requierePeriodo && (
        <div className="space-y-2">
          <Label required>Duración</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const active = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                    active
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  )}
                >
                  {duracionPresets[p].label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                preset === "custom"
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              )}
            >
              Personalizar
            </button>
          </div>

          {preset === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Desde"
                name="periodo_inicio"
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                error={state.fieldErrors.periodo_inicio}
              />
              <Input
                label="Hasta"
                name="periodo_fin"
                type="date"
                value={periodoFin}
                onChange={(e) => setPeriodoFin(e.target.value)}
                error={state.fieldErrors.periodo_fin}
              />
            </div>
          ) : (
            <>
              <input
                type="hidden"
                name="periodo_inicio"
                value={periodoInicio}
              />
              <input type="hidden" name="periodo_fin" value={periodoFin} />
              {periodoInicio && periodoFin && (
                <p className="text-xs text-text-muted">
                  Vigencia: {formatFecha(periodoInicio)} →{" "}
                  {formatFecha(periodoFin)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Monto y método */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Monto"
          name="monto"
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          required
          placeholder="0"
          leftSlot="$"
          error={state.fieldErrors.monto}
        />

        <div className="space-y-1.5">
          <Label>Método de pago</Label>
          <div className="grid grid-cols-3 gap-2">
            {metodoOptions.map((opt) => {
              const active = metodo === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMetodo(opt.value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors duration-150",
                    active
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  )}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="metodo_pago" value={metodo} />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={isPending} size="lg">
          Registrar pago
        </Button>
      </div>
    </form>
  );
}

function SelectedMiembroChip({
  miembro,
  onClear,
}: {
  miembro: MiembroLite;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-brand-green">
        <LuUser className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {miembro.nombre}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {miembro.fecha_vencimiento
            ? `Vence el ${formatFecha(miembro.fecha_vencimiento)}`
            : "Sin membresía vigente"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar selección"
        className="shrink-0 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}

function MiembroAutocomplete({
  onSelect,
}: {
  onSelect: (m: MiembroLite) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiembroLite[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchMiembrosAction(query);
      setResults(r);
      setIsSearching(false);
    }, 200);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Buscar miembro por nombre o teléfono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftSlot={<LuSearch className="h-4 w-4" />}
        autoComplete="off"
      />

      {(results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-text-secondary">
              Sin resultados
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      setQuery("");
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                      <LuUser className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {m.nombre}
                      </p>
                      {m.telefono && (
                        <p className="truncate font-mono text-xs text-text-secondary">
                          {m.telefono}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
