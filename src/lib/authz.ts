/**
 * Regras puras de autorização para deleção de usuário.
 *
 * Modelo:
 *  - Admin remove qualquer um (com proteção do último admin e do root).
 *  - 'user' remove apenas contas 'user' (inclusive a própria), nunca admins,
 *    e no máximo USER_DELETE_LIMIT por janela de DELETE_WINDOW_MS.
 *
 * Sem I/O: recebe o contexto já resolvido (inclusive quantas exclusões o autor
 * já fez na janela) e devolve a decisão.
 */

// Limite individual de exclusões do 'user' por janela de tempo.
export const USER_DELETE_LIMIT = 2;
export const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export interface DeletionTarget {
  email: string;
  role: string;
}

export interface DeletionContext {
  callerIsAdmin: boolean;
  callerIsRootAdmin: boolean;
  callerEmail: string | null;
  target: DeletionTarget | null;
  adminCount: number;
  /** Exclusões que o autor já fez na janela atual (admins ignoram o limite). */
  callerRecentDeletions: number;
}

export type DeletionDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function evaluateUserDeletion(ctx: DeletionContext): DeletionDecision {
  // 1. O alvo precisa existir.
  if (!ctx.target) {
    return { ok: false, status: 404, error: "Usuário não encontrado" };
  }

  // 2. Autorização por papel: não-admin só remove contas 'user'.
  if (!ctx.callerIsAdmin && ctx.target.role !== "user") {
    return { ok: false, status: 403, error: "Sem permissão" };
  }

  // 3. Limite diário do 'user' (admin não tem limite).
  if (!ctx.callerIsAdmin && ctx.callerRecentDeletions >= USER_DELETE_LIMIT) {
    return {
      ok: false,
      status: 403,
      error: "Limite de exclusões atingido. Tente novamente em 24h.",
    };
  }

  // 4. Não remover o último admin — o sistema ficaria sem gestão.
  if (ctx.target.role === "admin" && ctx.adminCount <= 1) {
    return {
      ok: false,
      status: 403,
      error: "Não é possível remover o único administrador do sistema.",
    };
  }

  // 5. Admin raiz não pode remover a própria conta.
  const callerEmail = ctx.callerEmail?.toLowerCase();
  const targetEmail = ctx.target.email?.toLowerCase();
  if (
    callerEmail &&
    targetEmail &&
    callerEmail === targetEmail &&
    ctx.callerIsRootAdmin
  ) {
    return {
      ok: false,
      status: 403,
      error: "Você não pode remover sua própria conta de administrador raiz.",
    };
  }

  return { ok: true };
}
