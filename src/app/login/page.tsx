"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShieldIcon, GoogleIcon, GithubIcon } from "@/components/icons";

export default function LoginPage() {
  const { user, loading, loginGoogle, loginGithub } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "google" | "github">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/admin");
  }, [loading, user, router]);

  async function handle(provider: "google" | "github", fn: () => Promise<void>) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (!code.includes("cancelled-popup") && !code.includes("popup-closed")) {
        setError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="animate-scale-in relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-text shadow-[var(--shadow)]">
            <ShieldIcon className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-text">Access Control</h1>
          <p className="mt-1 text-sm text-text-muted">Entre para gerenciar os usuários do sistema.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
          <div className="grid gap-2.5">
            <button onClick={() => handle("google", loginGoogle)} disabled={!!busy} className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 cursor-pointer">
              <GoogleIcon className="size-[18px]" />
              {busy === "google" ? "Conectando…" : "Entrar com Google"}
            </button>
            <button onClick={() => handle("github", loginGithub)} disabled={!!busy} className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 cursor-pointer">
              <GithubIcon className="size-[18px]" />
              {busy === "github" ? "Conectando…" : "Entrar com GitHub"}
            </button>
          </div>
          {error && (
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-center text-sm text-danger">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-faint">Acesso restrito a administradores autorizados.</p>
      </div>
    </main>
  );
}
