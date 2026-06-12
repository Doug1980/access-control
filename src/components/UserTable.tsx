"use client";

import { useMemo, useState } from "react";
import type { AppUser } from "@/types/user";

type SortKey = "name" | "email" | "role" | "createdAt";
type SortDir = "asc" | "desc";

interface Props {
  users: AppUser[];
  loading: boolean;
  hasSearch: boolean;
  /** UX apenas: esconde a lixeira para não-admin. A segurança real é no servidor. */
  canDelete: boolean;
  onEdit: (user: AppUser) => void;
  onDelete: (user: AppUser) => void;
}

const AVATAR_TONES = [
  "bg-[#5b54e8]", "bg-[#1f9d62]", "bg-[#c98a16]",
  "bg-[#d94545]", "bg-[#2a8ec9]", "bg-[#8a3fc0]",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function UserTable({
  users,
  loading,
  hasSearch,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [users, sortKey, sortDir]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-left">
              <SortableTh label="Usuário" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} className="pl-5" />
              <SortableTh label="Função" active={sortKey === "role"} dir={sortDir} onClick={() => toggleSort("role")} />
              <SortableTh label="Criado em" active={sortKey === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} />
              <th className="px-4 py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-text-faint">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : sorted.length === 0 ? (
              <tr><td colSpan={4}><EmptyState hasSearch={hasSearch} /></td></tr>
            ) : (
              sorted.map((u) => (
                <tr key={u._id} className="group border-b border-border last:border-0 hover:bg-surface-2/40">
                  <td className="py-3 pl-5 pr-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${toneFor(u.name)}`}>
                        {initials(u.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{u.name}</p>
                        <p className="truncate text-xs text-text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(u.createdAt)}</td>
                  <td className="py-3 pl-4 pr-5">
                    <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <button onClick={() => onEdit(u)} className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-accent-soft hover:text-accent" aria-label={`Editar ${u.name}`} title="Editar">
                        <PencilGlyph className="size-[17px]" />
                      </button>
                      {canDelete && (
                        <button onClick={() => onDelete(u)} className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Excluir ${u.name}`} title="Excluir">
                          <TrashGlyph className="size-[17px]" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick, className = "" }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string;
}) {
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button onClick={onClick} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${active ? "text-text" : "text-text-faint hover:text-text-muted"}`}>
        {label}
        {active ? (dir === "asc" ? <ChevronUpGlyph className="size-3.5" /> : <ChevronDownGlyph className="size-3.5" />) : <ArrowUpDownGlyph className="size-3.5 opacity-50" />}
      </button>
    </th>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isAdmin ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-muted"}`}>
      <span className={`size-1.5 rounded-full ${isAdmin ? "bg-accent" : "bg-text-faint"}`} />
      {role}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          <td className="py-3.5 pl-5 pr-4">
            <div className="flex items-center gap-3">
              <div className="skeleton size-9 rounded-full" />
              <div className="grid gap-1.5">
                <div className="skeleton h-3.5 w-32 rounded" />
                <div className="skeleton h-3 w-44 rounded" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5"><div className="skeleton h-6 w-16 rounded-full" /></td>
          <td className="px-4 py-3.5"><div className="skeleton h-3.5 w-20 rounded" /></td>
          <td className="py-3.5 pl-4 pr-5">
            <div className="ml-auto flex w-fit gap-1">
              <div className="skeleton size-8 rounded-lg" />
              <div className="skeleton size-8 rounded-lg" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-surface-2 text-text-faint">
        <UsersGlyph className="size-6" />
      </div>
      <p className="mt-4 font-medium text-text">{hasSearch ? "Nenhum resultado" : "Nenhum usuário ainda"}</p>
      <p className="mt-1 max-w-xs text-sm text-text-muted">
        {hasSearch ? "Tente ajustar os termos da busca." : "Crie o primeiro usuário para começar a gerenciar o acesso."}
      </p>
    </div>
  );
}

/* ---------- Ícones inline (autossuficiente — não depende de @/components/icons) ---------- */

type IconProps = { className?: string };
const baseIcon = (className?: string) => ({
  className,
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

function PencilGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function ChevronUpGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}
function ChevronDownGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ArrowUpDownGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}
function UsersGlyph({ className }: IconProps) {
  return (
    <svg {...baseIcon(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}