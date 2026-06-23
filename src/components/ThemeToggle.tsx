"use client";

import { useTheme } from "@/hooks/useTheme";
import { SunIcon, MoonIcon } from "@/components/icons";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:border-border-strong cursor-pointer"
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
    >
      {theme === "dark" ? (
        <SunIcon className="size-[18px]" />
      ) : (
        <MoonIcon className="size-[18px]" />
      )}
    </button>
  );
}
