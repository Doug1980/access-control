"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AppUser, CreateUserInput } from "@/types/user";
import { XIcon } from "@/components/icons";

interface Props {
  open: boolean;
  user: AppUser | null;
  /** Vem do useIsAdmin lá no admin/page.tsx. UX apenas — a segurança é no servidor. */
  canSetAdmin: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserInput) => Promise<void>;
}

const emptyForm: CreateUserInput = { name: "", email: "", role: "user" };

export function UserFormModal({
  open,
  user,
  canSetAdmin,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<CreateUserInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, role: user.role });
    else setForm(emptyForm);
    setError(null);
  }, [user, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canSave = form.name.trim().length > 0 && emailValid && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // Defesa em profundidade: não-admin nunca submete role "admin".
      // Em edição, preserva o role original (evita rebaixar admin sem querer).
      const safeRole: AppUser["role"] = canSetAdmin
        ? form.role
        : user?.role ?? "user";

      await onSubmit({ ...form, role: safeRole });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-md rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-text">
            {user ? "Editar usuário" : "Novo usuário"}
          </h2>
          <button
            onClick={onClose}
            className="-mr-2 grid size-8 place-items-center rounded-lg text-text-faint hover:bg-surface-2 hover:text-text"
            aria-label="Fechar"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <Field label="Nome">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ana Souza"
              className="input"
            />
          </Field>

          <Field
            label="E-mail"
            hint={form.email && !emailValid ? "Informe um e-mail válido." : undefined}
          >
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ana@empresa.com"
              className="input"
            />
          </Field>

          <Field
            label="Função"
            hint={
              !canSetAdmin
                ? "Apenas administradores podem atribuir o papel Admin."
                : undefined
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {(["user", "admin"] as const).map((r) => {
                const locked = r === "admin" && !canSetAdmin;
                const active = form.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={locked}
                    title={
                      locked
                        ? "Sem permissão para criar administradores"
                        : undefined
                    }
                    onClick={() => !locked && setForm({ ...form, role: r })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      locked
                        ? "cursor-not-allowed border-border bg-surface-2 text-text-faint opacity-60"
                        : active
                          ? "cursor-pointer border-accent bg-accent-soft text-accent"
                          : "cursor-pointer border-border bg-surface text-text-muted hover:border-border-strong"
                    }`}
                  >
                    {r}
                    {locked && <LockGlyph />}
                  </button>
                );
              })}
            </div>
          </Field>

          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
          <button onClick={onClose} className="btn-ghost cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave} className="btn-primary cursor-pointer">
            {saving ? "Salvando…" : user ? "Salvar alterações" : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cadeado inline (sem dependência externa de ícones). */
function LockGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-text">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </label>
  );
}