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

export function isRootAdmin(user: DecodedIdToken): boolean {
  return !!user.email && adminEmails.includes(user.email.toLowerCase());
}

export async function isAdmin(user: DecodedIdToken): Promise<boolean> {
  if (isRootAdmin(user)) return true;

  if (!user.email) {
    console.log("[isAdmin-debug] user.email VAZIO no token!"); // 🔍 temporário
    return false;
  }

  const db = await getDb();
  const record = await db
    .collection("users")
    .findOne({ email: user.email.toLowerCase() });

  // 🔍 LOG TEMPORÁRIO — remover depois
  console.log("[isAdmin-debug]", {
    emailDoToken: user.email,
    achouRegistro: !!record,
    roleDoRegistro: record?.role,
  });

  return record?.role === "admin";
}