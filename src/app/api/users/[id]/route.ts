import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import type { UpdateUserInput } from "@/types/user";

// Exige apenas estar autenticado (para editar).
async function requireAuth(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return null;
}

// Exige ser admin (para excluir — ação destrutiva, princípio do menor privilégio).
async function requireAdmin(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req.json()) as UpdateUserInput;

  // Só admin pode promover alguém a "admin". Não-admin não consegue alterar role para admin.
  const user = await verifyRequest(req);
  const safeBody = { ...body };
  if (body.role === "admin" && !(user && isAdmin(user))) {
    safeBody.role = "user";
  }

  const db = await getDb();
  const updated = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...safeBody, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );

  if (!updated) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const result = { ...updated, _id: updated._id.toString() };
  await pusherServer.trigger("users", "user:updated", result).catch(() => {});

  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const db = await getDb();
  const { deletedCount } = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
  if (deletedCount === 0) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  await pusherServer.trigger("users", "user:deleted", { id }).catch(() => {});

  return NextResponse.json({ ok: true });
}