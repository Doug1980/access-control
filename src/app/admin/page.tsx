"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usersApi } from "@/lib/api";
import { UserFormModal } from "@/components/UserFormModal";
import type { AppUser, CreateUserInput } from "@/types/user";

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  // proteção de rota no client
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      setUsers(await usersApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleSubmit(data: CreateUserInput) {
    if (editing) await usersApi.update(editing._id, data);
    else await usersApi.create(data);
    await load();
  }

  async function handleDelete(u: AppUser) {
    if (!confirm(`Excluir ${u.name}?`)) return;
    try {
      await usersApi.remove(u._id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  if (loading || !user) return <p className="p-8">Carregando...</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 grid gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{user.email}</span>
          <button onClick={logout} className="underline">Sair</button>
        </div>
      </header>

      <div className="flex gap-2">
        <input
          placeholder="Buscar por nome ou e-mail..."
          className="border rounded-lg px-3 py-2 flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="px-4 py-2 rounded-lg bg-black text-white whitespace-nowrap"
        >
          + Novo
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nenhum usuário</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => { setEditing(u); setModalOpen(true); }} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UserFormModal
        open={modalOpen}
        user={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </main>
  );
}