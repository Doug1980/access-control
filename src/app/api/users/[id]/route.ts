import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyRequest, isAdmin, isRootAdmin, resolveEmail } from "@/lib/auth";
import { evaluateUserDeletion, DELETE_WINDOW_MS } from "@/lib/authz";
import { recordDeletion, countRecentDeletions } from "@/lib/deletionLog";
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

  const safeUpdate: Record<string, string> = {};
  if (validation.data.name)  safeUpdate.name  = validation.data.name;
  if (validation.data.email) safeUpdate.email = validation.data.email;

  // Mudança de papel é exclusiva de admin (não-admin: role enviado é ignorado).
  if (validation.data.role !== undefined && callerIsAdmin) {
    if (
      validation.data.role !== "admin" &&
      isRootAdmin({ email: target.email } as never)
    ) {
      safeUpdate.role = target.role;
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

  const target = await db
    .collection("users")
    .findOne({ _id: new ObjectId(id) }, { projection: { email: 1, role: 1 } });

  const callerIsAdmin = await isAdmin(user);
  const callerEmail = resolveEmail(user);

  const adminCount =
    (target?.role as string | undefined) === "admin"
      ? await db.collection("users").countDocuments({ role: "admin" })
      : 0;

  // Conta exclusões recentes do autor (admins ignoram o limite, então pulamos).
  const callerRecentDeletions =
    !callerIsAdmin && callerEmail
      ? await countRecentDeletions(callerEmail, DELETE_WINDOW_MS)
      : 0;

  const decision = evaluateUserDeletion({
    callerIsAdmin,
    callerIsRootAdmin: isRootAdmin(user),
    callerEmail,
    target: target
      ? { email: target.email as string, role: target.role as string }
      : null,
    adminCount,
    callerRecentDeletions,
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

  // Registra a exclusão (conta para o limite e serve de auditoria).
  if (callerEmail) await recordDeletion(callerEmail, id);

  await pusherServer.trigger("users", "user:deleted", { id }).catch(() => {});

  return NextResponse.json({ ok: true });
}
