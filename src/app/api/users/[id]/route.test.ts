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

import { DELETE } from "./route";
import { verifyRequest, isAdmin, isRootAdmin, resolveEmail } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { pusherServer } from "@/lib/pusher";
import { rateLimit } from "@/lib/rateLimit";

// ObjectId válido (24 hex) — senão a rota devolve 400 "ID inválido".
const VALID_ID = "507f1f77bcf86cd799439011";

// "Banco" falso com as 3 operações que a rota usa.
function fakeDb(opts: {
  target: { email: string; role: string } | null;
  adminCount?: number;
  deletedCount?: number;
}) {
  const col = {
    findOne: vi.fn().mockResolvedValue(opts.target),
    countDocuments: vi.fn().mockResolvedValue(opts.adminCount ?? 0),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: opts.deletedCount ?? 1 }),
  };
  return { db: { collection: () => col }, col };
}

const req = () => new Request("http://localhost/api/users/x", { method: "DELETE" });
const params = { params: Promise.resolve({ id: VALID_ID }) };

// resetAllMocks limpa implementações entre testes; aqui voltamos aos defaults
// "felizes" (admin autenticado) e cada teste sobrescreve só o que lhe importa.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true } as never);
  vi.mocked(verifyRequest).mockResolvedValue({ uid: "u1", email: "admin@empresa.com" } as never);
  vi.mocked(isAdmin).mockResolvedValue(true);
  vi.mocked(isRootAdmin).mockReturnValue(false);
  vi.mocked(resolveEmail).mockReturnValue("admin@empresa.com");
  // A rota faz `pusherServer.trigger(...).catch(...)` — o mock PRECISA devolver
  // uma Promise, senão o `.catch` estoura. Gotcha clássico de mock encadeado.
  vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as never);
});

test("não-admin recebe 403 sem tocar no banco", async () => {
  vi.mocked(isAdmin).mockResolvedValue(false);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Sem permissão");
  expect(getDb).not.toHaveBeenCalled();
});

test("bloqueia remover o último admin (403, sem deletar)", async () => {
  const { db, col } = fakeDb({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 1 });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(403);
  expect((await res.json()).error).toMatch(/único administrador/);
  expect(col.deleteOne).not.toHaveBeenCalled();
});

test("admin deleta usuário comum: 200, chama deleteOne e dispara o Pusher", async () => {
  const { db, col } = fakeDb({ target: { email: "fulano@empresa.com", role: "user" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await DELETE(req(), params);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(col.deleteOne).toHaveBeenCalledTimes(1);
  expect(pusherServer.trigger).toHaveBeenCalledWith("users", "user:deleted", { id: VALID_ID });
});