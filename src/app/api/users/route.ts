import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import type { CreateUserInput } from "@/types/user";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = await getDb();
  const docs = await db
    .collection("users")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const users = docs.map((d) => ({ ...d, _id: d._id.toString() }));
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await req.json()) as CreateUserInput;

  if (!body?.name?.trim() || !body?.email?.trim()) {
    return NextResponse.json(
      { error: "Nome e e-mail são obrigatórios" },
      { status: 400 },
    );
  }

  // TRAVA DE PAPEL — fonte da verdade é o servidor.
  const callerIsAdmin = await isAdmin(user); // <- await
  const role: CreateUserInput["role"] =
    body.role === "admin" && callerIsAdmin ? "admin" : "user";

  const now = new Date().toISOString();
  const newUser = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    role,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const { insertedId } = await db.collection("users").insertOne(newUser);
  const result = { ...newUser, _id: insertedId.toString() };

  await pusherServer.trigger("users", "user:created", result).catch(() => {});

  return NextResponse.json(result, { status: 201 });
}