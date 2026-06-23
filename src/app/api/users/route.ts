import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { validateCreateUser } from "@/lib/validate";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const USER_PROJECTION = {
  _id: 1,
  name: 1,
  email: 1,
  role: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

export async function GET(req: Request) {
  const rl = rateLimit(req, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const skip  = (page - 1) * limit;

  const db = await getDb();
  const collection = db.collection("users");

  const [docs, total] = await Promise.all([
    collection
      .find({}, { projection: USER_PROJECTION })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(),
  ]);

  const users = docs.map((d) => ({ ...d, _id: d._id.toString() }));

  return NextResponse.json({
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const user = await verifyRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const validation = validateCreateUser(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // TRAVA DE PAPEL — fonte da verdade é o servidor.
  const callerIsAdmin = await isAdmin(user);
  const role = validation.data.role === "admin" && callerIsAdmin ? "admin" : "user";

  const now = new Date().toISOString();
  const newUser = {
    name:      validation.data.name,
    email:     validation.data.email,
    role,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();

  // Bloqueia e-mail duplicado
  const existing = await db.collection("users").findOne({ email: validation.data.email });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este e-mail." },
      { status: 409 },
    );
  }

  const { insertedId } = await db.collection("users").insertOne(newUser);
  const result = { ...newUser, _id: insertedId.toString() };

  await pusherServer.trigger("users", "user:created", result).catch(() => {});

  return NextResponse.json(result, { status: 201 });
}
