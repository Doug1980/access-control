"use client";

import { useAuth } from "@/hooks/useAuth";
import { ShieldIcon, LayoutDashboardIcon, UsersIcon, LogOutIcon } from "@/components/icons";

export function Sidebar() {
  const { user, logout } = useAuth();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email || "";
  const avatar = user?.photoURL;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-text">
          <ShieldIcon className="size-[18px]" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-text">Access Control</p>
          <p className="text-[11px] text-text-faint">Gestão de usuários</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">Geral</p>
        <a href="/admin" className="flex items-center gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent">
          <LayoutDashboardIcon className="size-[18px]" />
          Painel
        </a>
        <a href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text">
          <UsersIcon className="size-[18px]" />
          Usuários
        </a>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-text">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{displayName}</p>
            <p className="truncate text-xs text-text-muted">{email}</p>
          </div>
        </div>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-danger-soft hover:text-danger cursor-pointer">
          <LogOutIcon className="size-[18px]" />
          Sair
        </button>
      </div>
    </aside>
  );
}
