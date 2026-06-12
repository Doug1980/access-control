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

// Admins "raiz" — definidos por infra no .env. Nunca podem ser rebaixados pela UI.
export function isRootAdmin(user: DecodedIdToken): boolean {
  return !!user.email && adminEmails.includes(user.email.toLowerCase());
}

// Admin efetivo = raiz (env) OU promovido (role "admin" no banco, casado por e-mail).
export async function isAdmin(user: DecodedIdToken): Promise<boolean> {
  if (isRootAdmin(user)) return true;
  if (!user.email) return false;

  const db = await getDb();
  const record = await db
    .collection("users")
    .findOne({ email: user.email.toLowerCase() });

  return record?.role === "admin";
}