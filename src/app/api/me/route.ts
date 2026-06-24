import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin, resolveEmail } from "@/lib/auth";
import { countRecentDeletions } from "@/lib/deletionLog";
import { USER_DELETE_LIMIT, DELETE_WINDOW_MS } from "@/lib/authz";

export const runtime = "nodejs";

// Informa ao front quem é o usuário logado, se é admin e quantas exclusões
// ainda restam hoje (para a UI desabilitar a lixeira ao atingir o limite).
// Também auto-registra o usuário no banco na primeira vez que acessa.
export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const email = resolveEmail(user);

  // Auto-registro: se o usuário não existe no banco, cria como "user".
  if (email) {
    const db = await getDb();
    const exists = await db.collection("users").findOne({ email });
    if (!exists) {
      const now = new Date().toISOString();
      await db.collection("users").insertOne({
        name:      user.name ?? email.split("@")[0],
        email,
        role:      "user",
        createdAt: now,
        updatedAt: now,
      }).catch(() => {});
    }
  }

  const admin = await isAdmin(user);

  // deletionsRemaining: null = sem limite (admin); número = quantas faltam (user).
  let deletionsRemaining: number | null = null;
  if (email && !admin) {
    const used = await countRecentDeletions(email, DELETE_WINDOW_MS);
    deletionsRemaining = Math.max(0, USER_DELETE_LIMIT - used);
  }

  return NextResponse.json({ email, isAdmin: admin, deletionsRemaining });
}
