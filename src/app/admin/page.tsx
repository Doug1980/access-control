"use client";

import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { usersApi } from "@/lib/api";
import { usePusher } from "@/hooks/usePusher";
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
  const { isAdmin, email: myEmail, refresh: refreshIsAdmin, setAdmin } = useIsAdmin();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  // Espelho da lista para uso DENTRO dos handlers do Pusher (evita closure obsoleto).
  const usersRef = useRef<AppUser[]>([]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Espelhos para uso dentro dos handlers do Pusher (sempre valores frescos).
  const myEmailRef = useRef<string | null>(myEmail);
  useEffect(() => {
    myEmailRef.current = myEmail;
  }, [myEmail]);

  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Deduplicação de eventos do Pusher (guarda a última key por ~1s).
  const lastEvent = useRef<string>("");
  function isDuplicate(key: string) {
    if (lastEvent.current === key) return true;
    lastEvent.current = key;
    setTimeout(() => {
      if (lastEvent.current === key) lastEvent.current = "";
    }, 1000);
    return false;
  }

  usePusher({
    onCreated: (raw) => {
      const novo = raw as AppUser;
      if (isDuplicate(`created:${novo._id}`)) return;
      setUsers((prev) =>
        prev.some((u) => u._id === novo._id) ? prev : [novo, ...prev],
      );
      toast.success(`${novo.name} foi adicionado`);
    },
    onUpdated: (raw) => {
      const atualizado = raw as AppUser;
      if (isDuplicate(`updated:${atualizado._id}:${atualizado.updatedAt}`)) return;

      setUsers((prev) =>
        prev.map((u) => (u._id === atualizado._id ? atualizado : u)),
      );
      toast.success(`${atualizado.name} foi atualizado`);

      // Se o registro alterado sou EU (comparando com o e-mail confiável vindo
      // do servidor, não do user.email que pode ser undefined no GitHub),
      // aplico o role do PRÓPRIO payload — sem re-consultar, sem race com o banco.
      const meu = myEmailRef.current?.toLowerCase();
      const alvo = atualizado.email?.toLowerCase();
      if (meu && alvo && meu === alvo) {
        const viraAdmin = atualizado.role === "admin";
        const eraAdmin = isAdminRef.current;
        setAdmin(viraAdmin);
        if (!eraAdmin && viraAdmin) {
          toast.success("Você agora é administrador!");
        } else if (eraAdmin && !viraAdmin) {
          toast.error("Seu acesso de administrador foi removido.");
        }
      }
    },
    onDeleted: ({ id }) => {
      if (isDuplicate(`deleted:${id}`)) return;
      const alvo = usersRef.current.find((u) => u._id === id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      if (alvo) toast.success(`${alvo.name} foi removido`);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin").length;
    return { total: users.length, admins, members: users.length - admins };
  }, [users]);

  async function handleSubmit(data: CreateUserInput) {
    if (editing) {
      await usersApi.update(editing._id, data);
    } else {
      await usersApi.create(data);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await usersApi.remove(deleting._id);
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
            <p className="hidden text-xs text-text-muted sm:block">
              Gerencie quem tem acesso ao sistema.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-text-muted hover:text-danger md:hidden"
              aria-label="Sair"
            >
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
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail…"
                className="input pl-9"
              />
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <PlusIcon className="size-[18px]" />
              Novo usuário
            </button>
          </div>

          <div className="mt-4">
            <UserTable
              users={filtered}
              loading={fetching}
              hasSearch={search.trim().length > 0}
              canDelete={isAdmin}
              onEdit={(u) => {
                setEditing(u);
                setFormOpen(true);
              }}
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

      <UserFormModal
        open={formOpen}
        user={editing}
        canSetAdmin={isAdmin}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={!!deleting}
        userName={deleting?.name ?? ""}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}