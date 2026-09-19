"use client";

import { useState } from "react";
import { LuSend, LuBot } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface InboxInputProps {
  botActivo: boolean;
  enviando: boolean;
  cambiandoBot: boolean;
  onEnviar: (texto: string) => Promise<boolean>;
  onToggleBot: () => void;
}

export function InboxInput({
  botActivo,
  enviando,
  cambiandoBot,
  onEnviar,
  onToggleBot,
}: InboxInputProps) {
  const [texto, setTexto] = useState("");

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    const ok = await onEnviar(limpio);
    if (ok) setTexto("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  return (
    <div className="border-t border-border p-4">
      {/* Estado del bot: texto + botón de acción (sin interruptor en píldora). */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-text-secondary">
          <LuBot size={16} aria-hidden="true" />
          {botActivo
            ? "Bot activo: responde automáticamente"
            : "Bot en pausa: respondes tú"}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onToggleBot}
          loading={cambiandoBot}
          aria-pressed={botActivo}
        >
          {botActivo ? "Pausar bot" : "Activar bot"}
        </Button>
      </div>

      {/* Composer */}
      <div className="flex items-end gap-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Escribe tu mensaje…"
          aria-label="Mensaje"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded border border-border bg-bg px-3 py-3 text-sm leading-5 text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || !texto.trim()}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center bg-brand-green text-on-brand transition-colors",
            "hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:bg-brand-green/40 disabled:text-on-brand/60"
          )}
          aria-label="Enviar"
        >
          <LuSend size={18} />
        </button>
      </div>
    </div>
  );
}
