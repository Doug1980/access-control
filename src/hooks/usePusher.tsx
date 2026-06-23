"use client";

import { useEffect, useRef } from "react";
import PusherClient, { type Channel } from "pusher-js";

interface Handlers {
  onCreated: (user: unknown) => void;
  onUpdated: (user: unknown) => void;
  onDeleted: (payload: { id: string }) => void;
}

// Estado compartilhado no nível do módulo (sobrevive a remontagens do StrictMode).
let pusherSingleton: PusherClient | null = null;
let channelSingleton: Channel | null = null;
let bound = false; // trava: garante que os binds só aconteçam UMA vez

// Os handlers ficam aqui fora; o bind aponta para esta ref, que sempre
// reflete os callbacks mais recentes do componente.
const liveHandlers: { current: Handlers | null } = { current: null };

function ensurePusher() {
  if (!pusherSingleton) {
    pusherSingleton = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  if (!channelSingleton) {
    channelSingleton = pusherSingleton.subscribe("users");
  }
  if (!bound && channelSingleton) {
    // binds feitos UMA única vez na vida da aplicação
    channelSingleton.bind("user:created", (d: unknown) => liveHandlers.current?.onCreated(d));
    channelSingleton.bind("user:updated", (d: unknown) => liveHandlers.current?.onUpdated(d));
    channelSingleton.bind("user:deleted", (d: { id: string }) => liveHandlers.current?.onDeleted(d));
    bound = true;
  }
}

export function usePusher(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    // mantém os handlers globais sempre atualizados com os deste componente
    liveHandlers.current = ref.current;
    ensurePusher();
    // sem cleanup que remova binds: eles vivem uma vez só, à prova de StrictMode
  }, []);
}