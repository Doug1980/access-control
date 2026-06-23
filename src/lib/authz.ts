/**
 * Regras puras de autorização para deleção de usuário.
 *
 * Modelo de permissão:
 *  - Admin remove qualquer um (respeitando proteção do último admin e do root).
 *  - Usuário comum ('user') remove apenas contas de papel 'user' (inclusive a própria),
 *    nunca admins.
 *
 * Sem I/O: recebe o contexto já resolvido e devolve a decisão, com os mesmos
 * status/mensagens da rota DELETE — fonte única de verdade, fácil de testar.
 */

export interface DeletionTarget {
  email: string;
  role: string;
}

export interface DeletionContext {
  /** O autor é admin (raiz via env ou promovido no banco)? */
  callerIsAdmin: boolean;
  /** O autor é admin raiz (env)? Raiz não pode se autodeletar. */
  callerIsRootAdmin: boolean;
  /** E-mail confiável do autor, resolvido no servidor (ou null). */
  callerEmail: string | null;
  /** Usuário alvo da deleção, ou null se não existe. */
  target: DeletionTarget | null;
  /** Quantidade atual de admins (para proteger o último). */
  adminCount: number;
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

  // 3. Não remover o último admin — o sistema ficaria sem gestão.
  if (ctx.target.role === "admin" && ctx.adminCount <= 1) {
    return {
      ok: false,
      status: 403,
      error: "Não é possível remover o único administrador do sistema.",
    };
  }

  // 4. Admin raiz não pode remover a própria conta.
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
