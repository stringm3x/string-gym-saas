"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowLeft, LuMessageCircle } from "react-icons/lu";
import type {
  ConversacionResumen,
  MensajeInbox,
  MiembroResumenInbox,
} from "@/lib/queries/inbox.queries";
import {
  marcarLeidaAction,
  toggleBotAction,
  enviarMensajeAction,
} from "@/app/(tenant)/[slug]/comunicaciones/whatsapp/actions";
import { InboxSidebar, nombreVisible } from "./InboxSidebar";
import { HiloMensajes } from "./HiloMensajes";
import { InboxInput } from "./InboxInput";
import { useToast } from "@/components/ui/Toast";

const POLL_MS = 15_000;

interface InboxClientProps {
  slug: string;
  conversaciones: ConversacionResumen[];
  activeId: string | null;
  activa: ConversacionResumen | null;
  mensajes: MensajeInbox[];
  miembro: MiembroResumenInbox | null;
}

export function InboxClient({
  slug,
  conversaciones,
  activeId,
  activa,
  mensajes,
  miembro,
}: InboxClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [cambiandoBot, setCambiandoBot] = useState(false);

  const base = `/${slug}/comunicaciones/whatsapp`;

  // Polling: refresca los datos del servidor cada 15s mientras el inbox
  // está abierto. router.refresh() re-ejecuta el Server Component.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  function seleccionar(id: string) {
    router.push(`${base}?c=${id}`);
    // Marca como leída en segundo plano (revalida y limpia el badge).
    startTransition(async () => {
      await marcarLeidaAction(id);
    });
  }

  function volver() {
    router.push(base);
  }

  async function enviar(texto: string): Promise<boolean> {
    if (!activeId) return false;
    setEnviando(true);
    try {
      const r = await enviarMensajeAction(activeId, texto);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo enviar el mensaje.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setEnviando(false);
    }
  }

  function toggleBot() {
    if (!activeId) return;
    setCambiandoBot(true);
    startTransition(async () => {
      try {
        const r = await toggleBotAction(activeId);
        if (!r.ok) toast.error(r.error ?? "No se pudo cambiar el bot.");
        else router.refresh();
      } finally {
        setCambiandoBot(false);
      }
    });
  }

  const sidebar = (
    <InboxSidebar
      conversaciones={conversaciones}
      activeId={activeId}
      onSelect={seleccionar}
    />
  );

  const hilo = activa ? (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra volver — solo móvil */}
      <button
        type="button"
        onClick={volver}
        className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm text-text-secondary md:hidden"
      >
        <LuArrowLeft size={16} /> Volver
      </button>
      <div className="min-h-0 flex-1">
        <HiloMensajes
          titulo={nombreVisible(activa)}
          miembro={miembro}
          mensajes={mensajes}
        />
      </div>
      <InboxInput
        botActivo={activa.bot_activo}
        enviando={enviando}
        cambiandoBot={cambiandoBot || pending}
        onEnviar={enviar}
        onToggleBot={toggleBot}
      />
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
      <LuMessageCircle size={40} className="opacity-40" />
      <p className="text-sm">Selecciona una conversación</p>
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-canvas">
      {/* Desktop: 2 columnas */}
      <div className="hidden h-full md:grid md:grid-cols-[320px_1fr]">
        <div className="min-h-0 border-r border-border">{sidebar}</div>
        <div className="min-h-0">{hilo}</div>
      </div>

      {/* Móvil: lista o hilo, no ambos */}
      <div className="h-full md:hidden">{activeId ? hilo : sidebar}</div>
    </div>
  );
}
