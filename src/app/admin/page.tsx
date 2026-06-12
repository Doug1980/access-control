"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { usersApi } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatCard } from "@/components/StatCard";
import { UserTable } from "@/components/UserTable";
import { UserFormModal } from "@/components/UserFormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UsersIcon, ShieldIcon, PlusIcon, SearchIcon, LogOutIcon } from "@/components/icons";
import type { AppUser, CreateUserInput } from "@/types/user";

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      setUsers(await usersApi.list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar usuários.");
    } finally {
      setFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin").length;
    return { total: users.length, admins, members: users.length - admins };
  }, [users]);

  async function handleSubmit(data: CreateUserInput) {
    if (editing) {
      await usersApi.update(editing._id, data);
      toast.success("Usuário atualizado.");
    } else {
      await usersApi.create(data);
      toast.success("Usuário criado.");
    }
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await usersApi.remove(deleting._id);
      toast.success("Usuário excluído.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          <span className="text-sm">Carregando…</span>
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
            <h1 className="text-base font-semibold text-text">Usuários</h1>
            <p className="hidden text-xs text-text-muted sm:block">Gerencie quem tem acesso ao sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={logout} className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-text-muted hover:text-danger md:hidden" aria-label="Sair">
              <LogOutIcon className="size-[18px]" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 md:px-8 md:py-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total de usuários" value={stats.total} icon={<UsersIcon className="size-[18px]" />} tone="accent" loading={fetching} />
            <StatCard label="Administradores" value={stats.admins} icon={<ShieldIcon className="size-[18px]" />} tone="warning" loading={fetching} />
            <StatCard label="Membros" value={stats.members} icon={<UsersIcon className="size-[18px]" />} tone="success" loading={fetching} />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="input pl-9" />
            </div>
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-primary">
              <PlusIcon className="size-[18px]" />
              Novo usuário
            </button>
          </div>

          <div className="mt-4">
            <UserTable
              users={filtered}
              loading={fetching}
              hasSearch={search.trim().length > 0}
              onEdit={(u) => { setEditing(u); setFormOpen(true); }}
              onDelete={(u) => setDeleting(u)}
            />
          </div>

          {!fetching && filtered.length > 0 && (
            <p className="mt-3 text-xs text-text-faint">
              {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
              {search.trim() && ` · filtrando por "${search.trim()}"`}
            </p>
          )}
        </main>
      </div>

      <UserFormModal open={formOpen} user={editing} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
      <ConfirmDialog open={!!deleting} userName={deleting?.name ?? ""} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
    </div>
  );
}
