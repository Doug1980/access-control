"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon, LayoutDashboardIcon, UsersIcon } from "@/components/icons";

const navItems = [
  { label: "Painel",   href: "/admin",       icon: LayoutDashboardIcon },
  { label: "Usuarios", href: "/admin/users", icon: UsersIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-text">
          <ShieldIcon className="size-[18px]" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-text">Access Control</p>
          <p className="text-[11px] text-text-faint">Gestao de usuarios</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
          Geral
        </p>
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? "flex items-center gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
                  : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
