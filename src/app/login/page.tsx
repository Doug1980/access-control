"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { user, loading, loginGoogle, loginGithub } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/admin");
  }, [loading, user, router]);

  return (
    <main className="max-w-sm mx-auto mt-32 grid gap-3">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <button onClick={loginGoogle} className="border rounded-lg py-2 hover:bg-gray-50">
        Entrar com Google
      </button>
      <button onClick={loginGithub} className="border rounded-lg py-2 hover:bg-gray-50">
        Entrar com GitHub
      </button>
    </main>
  );
}