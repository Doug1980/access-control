"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, getToken } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setEmail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return; // token transitório nulo: não rebaixa
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // falha temporária: não rebaixa
      const data = await res.json();
      setIsAdmin(data.isAdmin === true);
      setEmail(data.email ?? null); // e-mail CONFIÁVEL, resolvido no servidor
    } catch {
      // erro transitório: mantém estado atual
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    check();
  }, [check]);

  // Aplica diretamente um valor de admin (usado quando o evento Pusher já
  // traz o role atualizado — evita re-consultar o servidor e a race com o banco).
  const setAdmin = useCallback((value: boolean) => {
    setIsAdmin(value);
  }, []);

  return { isAdmin, email, loading, refresh: check, setAdmin };
}