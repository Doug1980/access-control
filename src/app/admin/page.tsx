"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usersApi } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";
import { StatCard } from "@/components/StatCard";
import { UsersIcon, ShieldIcon, ArrowRightIcon } from "@/components/icons";
import type { AppUser } from "@/types/user";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isAdmin } = useIsAdmin();

  const [users, setUsers]       = useState<AppUser[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await usersApi.list(1, 100);
      setUsers(res.data);
    } catch {
      // falha silenciosa no dashboard
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin").length;
    return { total: users.length, admins, members: users.length - admins };
  }, [users]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Usuario";

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/80 px-5 backdrop-blur-md md:px-8">
          <div>
            <h1 className="text-base font-semibold text-text">Painel</h1>
            <p className="hidden text-xs text-text-muted sm:block">Visao geral do sistema.</p>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 md:px-8 md:py-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text">Ola, {displayName}</h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAdmin ? "Voce tem acesso de administrador." : "Bem-vindo ao Access Control."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total de usuarios"
              value={stats.total}
              icon={<UsersIcon className="size-[18px]" />}
              tone="accent"
              loading={fetching}
            />
            <StatCard
              label="Administradores"
              value={stats.admins}
              icon={<ShieldIcon className="size-[18px]" />}
              tone="warning"
              loading={fetching}
            />
            <StatCard
              label="Membros"
              value={stats.members}
              icon={<UsersIcon className="size-[18px]" />}
              tone="success"
              loading={fetching}
            />
          </div>

          {isAdmin && (
            <div className="mt-8">
              <Link
                href="/admin/users"
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 transition hover:border-accent hover:bg-accent-soft"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                    <UsersIcon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text">Gerenciar usuarios</p>
                    <p className="text-xs text-text-muted">Adicione, edite ou remova usuarios do sistema.</p>
                  </div>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-text-faint" />
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
