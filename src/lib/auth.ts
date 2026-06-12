import { adminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function verifyRequest(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await adminAuth.verifyIdToken(header.slice(7));
  } catch {
    return null;
  }
}

export function isAdmin(user: DecodedIdToken): boolean {
  return !!user.email && adminEmails.includes(user.email.toLowerCase());
}   