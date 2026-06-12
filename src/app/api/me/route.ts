import { NextResponse } from "next/server";
import { verifyRequest, isAdmin } from "@/lib/auth";

// Informa ao front quem é o usuário logado e se ele é admin.
// O front usa isso só para UI; a segurança real continua nas rotas de escrita.
export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email ?? null,
    isAdmin: await isAdmin(user), // <- agora com await
  });
}