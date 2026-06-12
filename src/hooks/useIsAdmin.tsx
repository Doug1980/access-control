"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

// Descobre se o usuário logado é admin, consultando /api/me.
// Reconsulta automaticamente quando o usuário muda (sem F5) e expõe
// um `refresh()` para reconsultar sob demanda (ex.: ao ser promovido em tempo real).
export function useIsAdmin() {
  const { user, getToken } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    // sem usuário logado → não é admin
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setIsAdmin(false);
        return;
      }
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsAdmin(res.ok && data.isAdmin === true);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  // Reconsulta quando o usuário muda.
  useEffect(() => {
    check();
  }, [check]);

  return { isAdmin, loading, refresh: check };
}