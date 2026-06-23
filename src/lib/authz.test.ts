import test from "node:test";
import assert from "node:assert/strict";
import { evaluateUserDeletion, type DeletionContext } from "./authz.ts";

// Contexto base: admin "comum" (não raiz) removendo um usuário comum existente.
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

test("não-admin é bloqueado com 403 antes de qualquer lookup", () => {
  const d = evaluateUserDeletion(ctx({ callerIsAdmin: false, target: null }));
  assert.deepEqual(d, { ok: false, status: 403, error: "Sem permissão" });
});

test("admin deletando usuário comum: permitido", () => {
  assert.deepEqual(evaluateUserDeletion(ctx()), { ok: true });
});

test("alvo inexistente retorna 404", () => {
  const d = evaluateUserDeletion(ctx({ target: null }));
  assert.deepEqual(d, { ok: false, status: 404, error: "Usuário não encontrado" });
});

test("não permite remover o último admin", () => {
  const d = evaluateUserDeletion(
    ctx({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 1 }),
  );
  assert.equal(d.ok, false);
  assert.equal((d as { status: number }).status, 403);
  assert.match((d as { error: string }).error, /único administrador/);
});

test("permite remover um admin quando há outros (adminCount > 1)", () => {
  const d = evaluateUserDeletion(
    ctx({ target: { email: "outro@empresa.com", role: "admin" }, adminCount: 2 }),
  );
  assert.deepEqual(d, { ok: true });
});

test("admin raiz não pode remover a própria conta", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: true,
      callerEmail: "root@empresa.com",
      target: { email: "root@empresa.com", role: "admin" },
    }),
  );
  assert.equal(d.ok, false);
  assert.match((d as { error: string }).error, /sua própria conta de administrador raiz/);
});

test("comparação de e-mail do auto-delete é case-insensitive", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: true,
      callerEmail: "Root@Empresa.com",
      target: { email: "root@empresa.com", role: "admin" },
    }),
  );
  assert.equal(d.ok, false);
  assert.match((d as { error: string }).error, /administrador raiz/);
});

test("admin NÃO-raiz pode remover a própria conta (só raiz é protegido)", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: false,
      callerEmail: "admin@empresa.com",
      target: { email: "admin@empresa.com", role: "admin" },
      adminCount: 2,
    }),
  );
  assert.deepEqual(d, { ok: true });
});

test("admin raiz pode remover OUTRO usuário normalmente", () => {
  const d = evaluateUserDeletion(
    ctx({
      callerIsRootAdmin: true,
      callerEmail: "root@empresa.com",
      target: { email: "outra.pessoa@empresa.com", role: "user" },
    }),
  );
  assert.deepEqual(d, { ok: true });
});

test("ordem de precedência: não-admin vence até a regra de último admin", () => {
  // Mesmo cenário que dispararia 'último admin', mas autor não é admin → 403 Sem permissão.
  const d = evaluateUserDeletion(
    ctx({ callerIsAdmin: false, target: { email: "x@e.com", role: "admin" }, adminCount: 1 }),
  );
  assert.equal((d as { error: string }).error, "Sem permissão");
});
