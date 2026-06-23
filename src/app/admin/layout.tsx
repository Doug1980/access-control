"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-bg px-4">{children}</div>;
}

/**
 * Guard de acesso ao painel: só admins entram em /admin/*.
 * Não-logado → redireciona pro login; logado sem privilégio → tela "Acesso restrito".
 * (Não dá pra redirecionar não-admin pro /login: ele bounce de volta, pois já está autenticado.)
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || adminLoading) {
    return (
      <FullScreen>
        <div className="flex items-center gap-3 text-text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          <span className="text-sm">Carregando...</span>
        </div>
      </FullScreen>
    );
  }

  if (!isAdmin) {
    return (
      <FullScreen>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-lg)]">
          <h1 className="text-lg font-semibold text-text">Acesso restrito</h1>
          <p className="mt-2 text-sm text-text-muted">
            Sua conta não tem permissão de administrador para acessar este painel.
          </p>
          <button onClick={() => logout()} className="btn-primary mt-6 w-full justify-center">
            Sair
          </button>
        </div>
      </FullScreen>
    );
  }

  return <>{children}</>;
}
