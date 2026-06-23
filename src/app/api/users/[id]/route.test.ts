import { test, expect, vi, beforeEach } from "vitest";

// --- Mocks das fronteiras de I/O (a lógica das rotas continua real) ---
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

import { DELETE, PATCH } from "./route";
import { verifyRequest, isAdmin, isRootAdmin, resolveEmail } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { pusherServer } from "@/lib/pusher";
import { rateLimit } from "@/lib/rateLimit";
import { validateUpdateUser } from "@/lib/validate";

// ObjectId válido (24 hex) — senão a rota devolve 400 "ID inválido".
const VALID_ID = "507f1f77bcf86cd799439011";

// "Banco" falso com as operações que as rotas usam.
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

const req = () => new Request("http://localhost/api/users/x", { method: "DELETE" });
const reqJson = (body: unknown) =>
  new Request("http://localhost/api/users/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const params = { params: Promise.resolve({ id: VALID_ID }) };

// Estado base "feliz" (admin autenticado); cada teste sobrescreve o que importa.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true } as never);
  vi.mocked(verifyRequest).mockResolvedValue({ uid: "u1", email: "admin@empresa.com" } as never);
  vi.mocked(isAdmin).mockResolvedValue(true);
  vi.mocked(isRootAdmin).mockReturnValue(false);
  vi.mocked(resolveEmail).mockReturnValue("admin@empresa.com");
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: {} } as never);
  vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as never);
});

// =========================== DELETE ===========================

test("DELETE: não-admin recebe 403 sem tocar no banco", async () => {
  vi.mocked(isAdmin).mockResolvedValue(false);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Sem permissão");
  expect(getDb).not.toHaveBeenCalled();
});

test("DELETE: bloqueia remover o último admin (403, sem deletar)", async () => {
  const { db, col } = fakeDb({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 1 });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/único administrador/);
  expect(col.deleteOne).not.toHaveBeenCalled();
});

test("DELETE: admin deleta usuário comum (200, deleteOne + Pusher)", async () => {
  const { db, col } = fakeDb({ target: { email: "fulano@empresa.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(col.deleteOne).toHaveBeenCalledTimes(1);
  expect(pusherServer.trigger).toHaveBeenCalledWith("users", "user:deleted", { id: VALID_ID });
});

// =========================== PATCH ============================

test("PATCH: não-admin não altera role (preserva o atual)", async () => {
  vi.mocked(isAdmin).mockResolvedValue(false);
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "admin" } } as never);

  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);

  const res = await PATCH(reqJson({ role: "admin" }), params);

  expect(res.status).toBe(200);
  // Gravou o role ATUAL ("user"), não o solicitado ("admin").
  expect(col.findOneAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $set: expect.objectContaining({ role: "user" }) },
    expect.anything(),
  );
});

test("PATCH: admin promove usuário para admin", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "admin" } } as never);

  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);

  const res = await PATCH(reqJson({ role: "admin" }), params);

  expect(res.status).toBe(200);
  expect(col.findOneAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $set: expect.objectContaining({ role: "admin" }) },
    expect.anything(),
  );
});

test("PATCH: admin NÃO consegue rebaixar um admin raiz (preserva admin)", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { role: "user" } } as never);
  vi.mocked(isRootAdmin).mockReturnValue(true); // o ALVO é root admin

  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "root@empresa.com", role: "admin" } });
  vi.mocked(getDb).mockResolvedValue(db as never);

  const res = await PATCH(reqJson({ role: "user" }), params);

  expect(res.status).toBe(200);
  expect(col.findOneAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $set: expect.objectContaining({ role: "admin" }) },
    expect.anything(),
  );
});

test("PATCH: sem role no payload, não mexe no role", async () => {
  vi.mocked(validateUpdateUser).mockReturnValue({ ok: true, data: { name: "Novo Nome" } } as never);

  const { db, col } = fakeDb({ target: { _id: VALID_ID, email: "x@e.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);

  await PATCH(reqJson({ name: "Novo Nome" }), params);

  // Inspeciona os argumentos da chamada: o $set não deve conter "role".
  const update = vi.mocked(col.findOneAndUpdate).mock.calls[0][1] as { $set: Record<string, unknown> };
  expect(update.$set).not.toHaveProperty("role");
  expect(update.$set).toHaveProperty("name", "Novo Nome");
});
