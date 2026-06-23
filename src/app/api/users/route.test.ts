import { test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/mongodb", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/pusher", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/validate", () => ({ validateCreateUser: vi.fn() }));

import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { pusherServer } from "@/lib/pusher";
import { rateLimit } from "@/lib/rateLimit";
import { validateCreateUser } from "@/lib/validate";

const ADMIN_OK = { ok: true, user: { uid: "u1", email: "admin@empresa.com" } };
const DENY_403 = { ok: false, status: 403, error: "Sem permissão" };

// Banco falso para a listagem (cursor encadeável) e para a criação.
function fakeListDb(docs: Array<Record<string, unknown>>) {
  const cursor: Record<string, unknown> = {
    sort: () => cursor,
    skip: () => cursor,
    limit: () => cursor,
    toArray: vi.fn().mockResolvedValue(docs),
  };
  const col = { find: () => cursor, countDocuments: vi.fn().mockResolvedValue(docs.length) };
  return { db: { collection: () => col }, col };
}
function fakeWriteDb(opts: { existing?: unknown; insertedId?: string }) {
  const col = {
    findOne: vi.fn().mockResolvedValue(opts.existing ?? null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => opts.insertedId ?? "abc" } }),
  };
  return { db: { collection: () => col }, col };
}

const reqGet = () => new Request("http://localhost/api/users");
const reqPost = (body: unknown = {}) =>
  new Request("http://localhost/api/users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true } as never);
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN_OK as never);
  vi.mocked(validateCreateUser).mockReturnValue({
    ok: true,
    data: { name: "Novo", email: "novo@empresa.com", role: "user" },
  } as never);
  vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as never);
});

test("GET: não-admin recebe 403 sem tocar no banco", async () => {
  vi.mocked(requireAdmin).mockResolvedValue(DENY_403 as never);
  const res = await GET(reqGet());
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Sem permissão");
  expect(getDb).not.toHaveBeenCalled();
});

test("GET: admin recebe a lista paginada", async () => {
  const { db } = fakeListDb([
    { _id: { toString: () => "1" }, name: "A", email: "a@e.com", role: "user", createdAt: "", updatedAt: "" },
  ]);
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await GET(reqGet());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.pagination.total).toBe(1);
});

test("POST: não-admin recebe 403 sem tocar no banco", async () => {
  vi.mocked(requireAdmin).mockResolvedValue(DENY_403 as never);
  const res = await POST(reqPost());
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Sem permissão");
  expect(getDb).not.toHaveBeenCalled();
});

test("POST: admin cria usuário (201 + Pusher)", async () => {
  const { db, col } = fakeWriteDb({ existing: null });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await POST(reqPost());
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.role).toBe("user");
  expect(col.insertOne).toHaveBeenCalledTimes(1);
  expect(pusherServer.trigger).toHaveBeenCalledWith("users", "user:created", expect.anything());
});

test("POST: e-mail duplicado retorna 409", async () => {
  const { db, col } = fakeWriteDb({ existing: { _id: "x", email: "novo@empresa.com" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await POST(reqPost());
  expect(res.status).toBe(409);
  expect(col.insertOne).not.toHaveBeenCalled();
});
