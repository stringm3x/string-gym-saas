"use client";

import { useState } from "react";
import { LuSend, LuBot } from "react-icons/lu";
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
    <div className="border-t border-border p-3">
      {/* Toggle del bot */}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <LuBot size={14} />
          {botActivo
            ? "Bot activo — responde automáticamente"
            : "Bot en pausa — respondes tú"}
        </span>
        <button
          type="button"
          onClick={onToggleBot}
          disabled={cambiandoBot}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
            botActivo ? "bg-brand-green" : "bg-border"
          )}
          aria-pressed={botActivo}
          aria-label="Alternar bot"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
              botActivo ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Escribe tu mensaje…"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || !texto.trim()}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-brand-green text-bg transition-opacity disabled:opacity-40"
          aria-label="Enviar"
        >
          <LuSend size={18} />
        </button>
      </div>
    </div>
  );
}
