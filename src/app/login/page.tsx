"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchSignInMethodsForEmail,
  linkWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { auth, googleProvider, githubProvider } from "@/lib/firebase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShieldIcon, GoogleIcon, GithubIcon } from "@/components/icons";

type Provider = "google" | "github";

// Mapeia o providerId retornado pelo Firebase para o nome amigavel
const PROVIDER_LABELS: Record<string, string> = {
  "google.com": "Google",
  "github.com": "GitHub",
};

export default function LoginPage() {
  const { user, loading, loginGoogle, loginGithub } = useAuth();
  const router = useRouter();
  const [busy, setBusy]   = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/admin");
  }, [loading, user, router]);

  async function handle(provider: Provider, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      const code  = (e as { code?: string })?.code ?? "";
      const email = (e as { customData?: { email?: string } })?.customData?.email ?? "";

      if (code.includes("cancelled-popup") || code.includes("popup-closed")) {
        // usuario fechou o popup — nao mostra erro
      } else if (code === "auth/account-exists-with-different-credential" && email) {
        // Mesmo e-mail ja cadastrado com outro provedor — faz o link automatico.
        await handleAccountLink(e, email);
      } else {
        setError("Nao foi possivel entrar. Tente novamente.");
      }
    } finally {
      setBusy(null);
    }
  }

  /**
   * Quando o usuario tenta entrar com um provedor (ex: Google) mas o email
   * ja esta vinculado a outro (ex: GitHub), o Firebase lanca
   * "account-exists-with-different-credential".
   *
   * Solucao: descobrimos qual provedor existente tem aquele email,
   * fazemos o sign-in com ele e entao linkamos a nova credencial pendente.
   * Resultado: o usuario fica com os dois provedores vinculados na mesma conta.
   */
  async function handleAccountLink(originalError: unknown, email: string) {
    try {
      // Descobre qual(is) provedor(es) ja esta(o) cadastrado(s) para esse email
      const methods = await fetchSignInMethodsForEmail(auth, email);

      // Escolhe o primeiro provedor alternativo disponivel
      const existingProvider = methods.find((m) => m === "github.com" || m === "google.com");

      if (!existingProvider) {
        setError("Conta ja existente com credenciais diferentes. Tente outro metodo.");
        return;
      }

      const oauthProvider = existingProvider === "github.com" ? githubProvider : googleProvider;
      const label = PROVIDER_LABELS[existingProvider] ?? existingProvider;

      // 1. Faz login com o provedor existente
      const result = await signInWithPopup(auth, oauthProvider);

      // 2. Vincula a credencial pendente (o provedor que o usuario tentou usar)
      const pendingCred = (originalError as { credential?: Parameters<typeof linkWithPopup>[1] })?.credential;
      if (pendingCred) {
        await linkWithPopup(result.user, oauthProvider);
      }

      // 3. Se chegou aqui, o login foi bem-sucedido — o useEffect redireciona
    } catch (linkErr: unknown) {
      const linkCode = (linkErr as { code?: string })?.code ?? "";
      if (linkCode.includes("cancelled-popup") || linkCode.includes("popup-closed")) return;

      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [] as string[]);
      const label = PROVIDER_LABELS[methods[0]] ?? "outro metodo";
      setError(
        `Este e-mail esta vinculado ao ${label}. Entre com ${label} — os provedores serao vinculados automaticamente na proxima tentativa.`
      );
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
          <p className="mt-1 text-sm text-text-muted">Entre para gerenciar os usuarios do sistema.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
          <div className="grid gap-2.5">
            <button
              onClick={() => handle("google", loginGoogle)}
              disabled={!!busy}
              className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 cursor-pointer"
            >
              <GoogleIcon className="size-[18px]" />
              {busy === "google" ? "Conectando..." : "Entrar com Google"}
            </button>
            <button
              onClick={() => handle("github", loginGithub)}
              disabled={!!busy}
              className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 cursor-pointer"
            >
              <GithubIcon className="size-[18px]" />
              {busy === "github" ? "Conectando..." : "Entrar com GitHub"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-center text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-faint">
          Acesso restrito a administradores autorizados.
        </p>
      </div>
    </main>
  );
}
