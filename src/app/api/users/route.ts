import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin } from "@/lib/auth";
import type { CreateUserInput } from "@/types/user";

export async function GET(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const db = await getDb();
  const users = await db.collection("users").find().sort({ createdAt: -1 }).toArray();
  return NextResponse.json(users.map((u) => ({ ...u, _id: u._id.toString() })));
}

export async function POST(req: Request) {
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = (await req.json()) as CreateUserInput;
  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const doc = { name: body.name, email: body.email, role: body.role ?? "user", createdAt: now, updatedAt: now };
  const { insertedId } = await db.collection("users").insertOne(doc);
  return NextResponse.json({ ...doc, _id: insertedId.toString() }, { status: 201 });
}