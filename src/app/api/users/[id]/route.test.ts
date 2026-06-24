import { test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  verifyRequest: vi.fn(),
  isAdmin: vi.fn(),
  isRootAdmin: vi.fn(),
  resolveEmail: vi.fn(),
}));
vi.mock("@/lib/mongodb", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/pusher", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/validate", () => ({ validateUpdateUser: vi.fn() }));
vi.mock("@/lib/deletionLog", () => ({ recordDeletion: vi.fn(), countRecentDeletions: vi.fn() }));

import { DELETE, PATCH } from "./route";
import { verifyRequest, isAdmin, isRootAdmin, resolveEmail } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { pusherServer } from "@/lib/pusher";
import { rateLimit } from "@/lib/rateLimit";
import { validateUpdateUser } from "@/lib/validate";
import { recordDeletion, countRecentDeletions } from "@/lib/deletionLog";

const VALID_ID = "507f1f77bcf86cd799439011";

function fakeDb(opts: {
  target: { _id?: string; email: string; role: string } | null;
  adminCount?: number;
  deletedCount?: number;
  updated?: unknown;
}) {
  const col = {
    findOne: vi.fn().mockResolvedValue(opts.target),
    countDocuments: vi.fn().mockResolvedValue(opts.adminCount ?? 0),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: opts.deletedCount ?? 1 }),
    findOneAndUpdate: vi.fn().mockResolvedValue(opts.updated ?? opts.target),
  };
  return { db: { collection: () => col }, col };
}

const reqDel = () => new Request("http://localhost/api/users/x", { method: "DELETE" });
const reqPatch = (body: unknown) =>
  new Request("http://localhost/api/users/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const params = { params: Promise.resolve({ id: VALID_ID }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true } as never);
  vi.mocked(verifyRequest).mockResolvedValue({ uid: "u1", email: "caller@empresa.com" } as never);
  vi.mocked(isAdmin).mockResolvedValue(false); // por padrão, autor é 'user'
  vi.mocked(isRootAdmin).mockReturnValue(false);
  vi.mocked(resolveEmail).mockReturnValue("caller@empresa.com");
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: {} } as never);
  vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as never);
  vi.mocked(countRecentDeletions).mockResolvedValue(0);
  vi.mocked(recordDeletion).mockResolvedValue(undefined as never);
});

// =========================== DELETE ===========================

test("DELETE: admin deleta usuário comum (200)", async () => {
  vi.mocked(isAdmin).mockResolvedValue(true);
  const { db, col } = fakeDb({ target: { email: "fulano@empresa.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(reqDel(), params);
  expect(res.status).toBe(200);
  expect(col.deleteOne).toHaveBeenCalledTimes(1);
});

test("DELETE: user comum deleta outro user (200, registra a exclusão)", async () => {
  const { db, col } = fakeDb({ target: { email: "outro@empresa.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(reqDel(), params);
  expect(res.status).toBe(200);
  expect(col.deleteOne).toHaveBeenCalledTimes(1);
  expect(recordDeletion).toHaveBeenCalledTimes(1);
});

test("DELETE: user comum NÃO deleta admin (403, sem deletar)", async () => {
  const { db, col } = fakeDb({ target: { email: "chefe@empresa.com", role: "admin" }, adminCount: 3 });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(reqDel(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Sem permissão");
  expect(col.deleteOne).not.toHaveBeenCalled();
});

test("DELETE: user que atingiu o limite (2/24h) é bloqueado (403, sem deletar)", async () => {
  vi.mocked(countRecentDeletions).mockResolvedValue(2);
  const { db, col } = fakeDb({ target: { email: "outro@empresa.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(reqDel(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/Limite de exclusões/);
  expect(col.deleteOne).not.toHaveBeenCalled();
});

test("DELETE: admin não remove o último admin (403)", async () => {
  vi.mocked(isAdmin).mockResolvedValue(true);
  const { db, col } = fakeDb({ target: { email: "x@e.com", role: "admin" }, adminCount: 1 });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(reqDel(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/único administrador/);
  expect(col.deleteOne).not.toHaveBeenCalled();
});

// =========================== PATCH ============================

test("PATCH: admin promove usuário para admin", async () => {
  vi.mocked(isAdmin).mockResolvedValue(true);
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "admin" } } as never);
  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await PATCH(reqPatch({ role: "admin" }), params);
  expect(res.status).toBe(200);
  expect(col.findOneAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $set: expect.objectContaining({ role: "admin" }) },
    expect.anything(),
  );
});

test("PATCH: user comum edita nome de outro user (200, sem mexer no role)", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { name: "Novo Nome" } } as never);
  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await PATCH(reqPatch({ name: "Novo Nome" }), params);
  expect(res.status).toBe(200);
  const update = vi.mocked(col.findOneAndUpdate).mock.calls[0][1] as { $set: Record<string, unknown> };
  expect(update.$set).toHaveProperty("name", "Novo Nome");
  expect(update.$set).not.toHaveProperty("role");
});

test("PATCH: user comum NÃO edita um admin (403)", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { name: "x" } } as never);
  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "chefe@e.com", role: "admin" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await PATCH(reqPatch({ name: "x" }), params);
  expect(res.status).toBe(403);
  expect(col.findOneAndUpdate).not.toHaveBeenCalled();
});

test("PATCH: user comum não consegue mudar papel (role ignorado)", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "admin" } } as never);
  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await PATCH(reqPatch({ role: "admin" }), params);
  expect(res.status).toBe(200);
  const update = vi.mocked(col.findOneAndUpdate).mock.calls[0][1] as { $set: Record<string, unknown> };
  expect(update.$set).not.toHaveProperty("role");
});

test("PATCH: admin NÃO rebaixa um admin raiz (preserva admin)", async () => {
  vi.mocked(isAdmin).mockResolvedValue(true);
  vi.mocked(isRootAdmin).mockReturnValue(true);
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "user" } } as never);
  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "root@e.com", role: "admin" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await PATCH(reqPatch({ role: "user" }), params);
  expect(res.status).toBe(200);
  expect(col.findOneAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $set: expect.objectContaining({ role: "admin" }) },
    expect.anything(),
  );
});
