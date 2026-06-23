import { test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ verifyRequest: vi.fn(), isAdmin: vi.fn() }));
vi.mock("@/lib/mongodb", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/pusher", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/validate", () => ({ validateCreateUser: vi.fn() }));

import { GET, POST } from "./route";
import { verifyRequest, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { pusherServer } from "@/lib/pusher";
import { rateLimit } from "@/lib/rateLimit";
import { validateCreateUser } from "@/lib/validate";

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
  vi.mocked(verifyRequest).mockResolvedValue({ uid: "u1", email: "user@empresa.com" } as never);
  vi.mocked(isAdmin).mockResolvedValue(false); // por padrão, não-admin
  vi.mocked(validateCreateUser).mockReturnValue({
    ok: true,
    data: { name: "Novo", email: "novo@empresa.com", role: "user" },
  } as never);
  vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as never);
});

test("GET: sem autenticação retorna 401", async () => {
  vi.mocked(verifyRequest).mockResolvedValue(null as never);
  const res = await GET(reqGet());
  expect(res.status).toBe(401);
});

test("GET: autenticado recebe a lista paginada", async () => {
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

test("POST: sem autenticação retorna 401", async () => {
  vi.mocked(verifyRequest).mockResolvedValue(null as never);
  const res = await POST(reqPost());
  expect(res.status).toBe(401);
});

test("POST: não-admin pedindo role admin é forçado para user", async () => {
  vi.mocked(validateCreateUser).mockReturnValue({
    ok: true,
    data: { name: "X", email: "x@e.com", role: "admin" },
  } as never);
  const { db } = fakeWriteDb({ existing: null });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await POST(reqPost({ role: "admin" }));
  expect(res.status).toBe(201);
  expect((await res.json()).role).toBe("user"); // trava de papel no servidor
});

test("POST: admin consegue criar admin", async () => {
  vi.mocked(isAdmin).mockResolvedValue(true);
  vi.mocked(validateCreateUser).mockReturnValue({
    ok: true,
    data: { name: "X", email: "x@e.com", role: "admin" },
  } as never);
  const { db } = fakeWriteDb({ existing: null });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await POST(reqPost({ role: "admin" }));
  expect(res.status).toBe(201);
  expect((await res.json()).role).toBe("admin");
});

test("POST: e-mail duplicado retorna 409", async () => {
  const { db, col } = fakeWriteDb({ existing: { _id: "x", email: "novo@empresa.com" } });
  vi.mocked(getDb).mockResolvedValue(db as never);
  const res = await POST(reqPost());
  expect(res.status).toBe(409);
  expect(col.insertOne).not.toHaveBeenCalled();
});
