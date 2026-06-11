import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin } from "@/lib/auth";
import type { UpdateUserInput } from "@/types/user";

// guard centralizado pra não repetir as duas checagens em todo handler
async function guard(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req.json()) as UpdateUserInput;
  const db = await getDb();
  const updated = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...body, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  if (!updated) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json({ ...updated, _id: updated._id.toString() });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const db = await getDb();
  const { deletedCount } = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
  if (deletedCount === 0) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}