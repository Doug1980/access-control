"use client";

import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOutIcon } from "@/components/icons";

export function UserMenu() {
  const { user, logout } = useAuth();

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Usuario";
  const email       = user?.email ?? "";
  const avatar      = user?.photoURL;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-text leading-tight">{displayName}</p>
        <p className="text-xs text-text-muted leading-tight">{email}</p>
      </div>

      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-text">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
      )}

      <ThemeToggle />

      <button
        onClick={logout}
        title="Sair"
        className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-text-muted hover:bg-danger-soft hover:text-danger transition-colors"
        aria-label="Sair"
      >
        <LogOutIcon className="size-[18px]" />
      </button>
    </div>
  );
}
