import { test, expect } from "vitest";
import { evaluateUserDeletion, type DeletionContext } from "./authz";

// Base: ADMIN removendo um 'user' comum existente.
function ctx(overrides: Partial<DeletionContext> = {}): DeletionContext {
  return {
    callerIsAdmin: true,
    callerIsRootAdmin: false,
    callerEmail: "admin@empresa.com",
    target: { email: "fulano@empresa.com", role: "user" },
    adminCount: 3,
    ...overrides,
  };
}

test("alvo inexistente retorna 404", () => {
  const d = evaluateUserDeletion(ctx({ target: null }));
  expect(d).toEqual({ ok: false, status: 404, error: "Usuário não encontrado" });
});

test("admin deleta usuário comum: permitido", () => {
  expect(evaluateUserDeletion(ctx())).toEqual({ ok: true });
});

test("admin deleta outro admin quando há outros: permitido", () => {
  const d = evaluateUserDeletion(
    ctx({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 2 }),
  );
  expect(d).toEqual({ ok: true });
});

test("user comum deleta outro user: permitido", () => {
  const d = evaluateUserDeletion(
    ctx({ callerIsAdmin: false, callerEmail: "user@empresa.com" }),
  );
  expect(d).toEqual({ ok: true });
});

test("user comum NÃO pode deletar um admin (403)", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsAdmin: false,
      callerEmail: "user@empresa.com",
      target: { email: "chefe@empresa.com", role: "admin" },
      adminCount: 3,
    }),
  );
  expect(d.ok).toBe(false);
  if (d.ok) return;
  expect(d.status).toBe(403);
  expect(d.error).toBe("Sem permissão");
});

test("user comum pode deletar a própria conta (é 'user')", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsAdmin: false,
      callerEmail: "user@empresa.com",
      target: { email: "user@empresa.com", role: "user" },
    }),
  );
  expect(d).toEqual({ ok: true });
});

test("não permite remover o último admin", () => {
  const d = evaluateUserDeletion(
    ctx({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 1 }),
  );
  expect(d.ok).toBe(false);
  if (d.ok) return;
  expect(d.status).toBe(403);
  expect(d.error).toMatch(/único administrador/);
});

test("admin raiz não pode remover a própria conta", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: true,
      callerEmail: "root@empresa.com",
      target: { email: "root@empresa.com", role: "admin" },
      adminCount: 3,
    }),
  );
  expect(d.ok).toBe(false);
  if (d.ok) return;
  expect(d.error).toMatch(/sua própria conta de administrador raiz/);
});

test("auto-delete do root é case-insensitive", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: true,
      callerEmail: "Root@Empresa.com",
      target: { email: "root@empresa.com", role: "admin" },
      adminCount: 3,
    }),
  );
  expect(d.ok).toBe(false);
});
