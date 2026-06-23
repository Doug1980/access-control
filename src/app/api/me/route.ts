import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin, resolveEmail } from "@/lib/auth";

export const runtime = "nodejs";

// Informa ao front quem é o usuário logado e se ele é admin.
// Também auto-registra o usuário no banco na primeira vez que acessa.
export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const email = resolveEmail(user);

  // Auto-registro: se o usuário não existe no banco, cria como "user"
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
      }).catch(() => {}); // ignora race condition (dois requests simultâneos)
    }
  }

  return NextResponse.json({
    email,
    isAdmin: await isAdmin(user),
  });
}