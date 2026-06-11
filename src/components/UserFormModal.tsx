"use client";
import { useEffect, useState } from "react";
import type { AppUser, CreateUserInput } from "@/types/user";

interface Props {
  open: boolean;
  user: AppUser | null; // null = modo criar
  onClose: () => void;
  onSubmit: (data: CreateUserInput) => Promise<void>;
}

export function UserFormModal({ open, user, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CreateUserInput>({ name: "", email: "", role: "user" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sincroniza o form quando abre em modo edição
  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, role: user.role });
    else setForm({ name: "", email: "", role: "user" });
    setError(null);
  }, [user, open]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md grid gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{user ? "Editar usuário" : "Novo usuário"}</h2>

        <label className="grid gap-1 text-sm">
          Nome
          <input
            className="border rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-sm">
          E-mail
          <input
            type="email"
            className="border rounded-lg px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="grid gap-1 text-sm">
          Função
          <select
            className="border rounded-lg px-3 py-2"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.email}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}