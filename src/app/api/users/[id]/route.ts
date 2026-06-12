import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin, isRootAdmin } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import type { UpdateUserInput } from "@/types/user";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await req.json()) as UpdateUserInput;
  const callerIsAdmin = await isAdmin(user);

  const db = await getDb();

  // Alvo da edição (precisamos saber o estado atual dele).
  const target = await db
    .collection("users")
    .findOne({ _id: new ObjectId(id) });
  if (!target) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  const safeBody = { ...body };

  // Trava de papel:
  if (!callerIsAdmin) {
    // Não-admin nunca altera role: preserva o atual (não promove nem rebaixa).
    safeBody.role = target.role;
  } else if (
    body.role &&
    body.role !== "admin" &&
    isRootAdmin({ email: target.email } as never)
  ) {
    // Admin comum não pode rebaixar um admin RAIZ (definido no .env).
    safeBody.role = target.role;
  }

  const updated = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...safeBody, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );

  if (!updated) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  const result = { ...updated, _id: updated._id.toString() };
  await pusherServer.trigger("users", "user:updated", result).catch(() => {});

  return NextResponse.json(result);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!(await isAdmin(user))) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const db = await getDb();
  const { deletedCount } = await db
    .collection("users")
    .deleteOne({ _id: new ObjectId(id) });
  if (deletedCount === 0) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  await pusherServer.trigger("users", "user:deleted", { id }).catch(() => {});

  return NextResponse.json({ ok: true });
}