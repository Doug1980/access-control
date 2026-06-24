"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, getToken } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  // null = sem limite (admin); número = exclusões restantes hoje (user).
  const [deletionsRemaining, setDeletionsRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setEmail(null);
      setDeletionsRemaining(null);
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
      setDeletionsRemaining(data.deletionsRemaining ?? null);
    } catch {
      // erro transitório: mantém estado atual
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    check();
  }, [check]);

  const setAdmin = useCallback((value: boolean) => {
    setIsAdmin(value);
  }, []);

  return { isAdmin, email, deletionsRemaining, loading, refresh: check, setAdmin };
}
