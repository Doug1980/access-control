import { adminAuth } from "@/lib/firebase/admin";
import { getDb } from "@/lib/mongodb";
import type { DecodedIdToken } from "firebase-admin/auth";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function verifyRequest(
  req: Request,
): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await adminAuth.verifyIdToken(header.slice(7));
  } catch {
    return null;
  }
}

/**
 * Resolve o e-mail do token de forma segura.
 *
 * O GitHub permite que usuários mantenham o e-mail privado. Nesses casos,
 * o Firebase preenche `user.email` como null, mas ainda disponibiliza o
 * e-mail em `firebase.identities["email"][0]`.
 * Verificamos ambos para não bloquear logins legítimos.
 */
export function resolveEmail(user: DecodedIdToken): string | null {
  if (user.email) return user.email.toLowerCase();

  // Fallback: provedores OAuth (GitHub, etc.) que ocultam o email principal
  const identities = (user.firebase as Record<string, unknown>)
    ?.identities as Record<string, unknown[]> | undefined;
  const emails = identities?.["email"];
  if (Array.isArray(emails) && emails.length > 0) {
    return String(emails[0]).toLowerCase();
  }

  return null;
}

// Admins "raiz" — definidos por infra no .env. Nunca podem ser rebaixados pela UI.
export function isRootAdmin(user: DecodedIdToken): boolean {
  const email = resolveEmail(user);
  return !!email && adminEmails.includes(email);
}

// Admin efetivo = raiz (env) OU promovido (role "admin" no banco, casado por e-mail).
export async function isAdmin(user: DecodedIdToken): Promise<boolean> {
  if (isRootAdmin(user)) return true;

  const email = resolveEmail(user);
  if (!email) return false;

  const db = await getDb();
  const record = await db.collection("users").findOne({ email });
  return record?.role === "admin";
}

// Resultado do guard de rota — sem acoplar ao Next; a rota traduz em HTTP.
export type AuthResult =
  | { ok: true; user: DecodedIdToken }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Guard de rota: exige usuário autenticado E admin.
 * Centraliza a trava usada por todas as rotas de escrita/leitura sensível.
 */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const user = await verifyRequest(req);
  if (!user) return { ok: false, status: 401, error: "Não autenticado" };
  if (!(await isAdmin(user))) return { ok: false, status: 403, error: "Sem permissão" };
  return { ok: true, user };
}
