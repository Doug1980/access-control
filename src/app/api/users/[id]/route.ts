import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin, isRootAdmin, resolveEmail } from "@/lib/auth";
import { evaluateUserDeletion } from "@/lib/authz";
import { pusherServer } from "@/lib/pusher";
import { validateUpdateUser } from "@/lib/validate";
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit(req, { limit: 30, windowMs: 60_000 });
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

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const validation = validateUpdateUser(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const target = await db
    .collection("users")
    .findOne({ _id: new ObjectId(id) }, { projection: USER_PROJECTION });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const callerIsAdmin = await isAdmin(user);

  // Autorização: admin edita qualquer um; 'user' só edita contas 'user'.
  if (!callerIsAdmin && target.role !== "user") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Allowlist explícita — apenas campos validados chegam ao banco.
  const safeUpdate: Record<string, string> = {};
  if (validation.data.name)  safeUpdate.name  = validation.data.name;
  if (validation.data.email) safeUpdate.email = validation.data.email;

  // Mudança de papel é exclusiva de admin (não-admin: role enviado é ignorado).
  if (validation.data.role !== undefined && callerIsAdmin) {
    if (
      validation.data.role !== "admin" &&
      isRootAdmin({ email: target.email } as never)
    ) {
      safeUpdate.role = target.role; // admin comum não rebaixa o root
    } else {
      safeUpdate.role = validation.data.role;
    }
  }

  const updated = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...safeUpdate, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: USER_PROJECTION },
  );

  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const result = { ...updated, _id: updated._id.toString() };
  await pusherServer.trigger("users", "user:updated", result).catch(() => {});

  return NextResponse.json(result);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
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

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const db = await getDb();

  // Projeção inclui `role` — necessário para a autorização e a regra do "último admin".
  const target = await db
    .collection("users")
    .findOne({ _id: new ObjectId(id) }, { projection: { email: 1, role: 1 } });

  const callerIsAdmin = await isAdmin(user);

  const adminCount =
    (target?.role as string | undefined) === "admin"
      ? await db.collection("users").countDocuments({ role: "admin" })
      : 0;

  // Decisão de autorização centralizada e testada em src/lib/authz.ts.
  const decision = evaluateUserDeletion({
    callerIsAdmin,
    callerIsRootAdmin: isRootAdmin(user),
    callerEmail: resolveEmail(user),
    target: target
      ? { email: target.email as string, role: target.role as string }
      : null,
    adminCount,
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const { deletedCount } = await db
    .collection("users")
    .deleteOne({ _id: new ObjectId(id) });

  if (deletedCount === 0) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await pusherServer.trigger("users", "user:deleted", { id }).catch(() => {});

  return NextResponse.json({ ok: true });
}
