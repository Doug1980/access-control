/**
 * Regras puras de autorização para deleção de usuário.
 *
 * Sem I/O: recebe o contexto já resolvido (quem chama, alvo, contagem de admins)
 * e devolve a decisão. Mantém EXATAMENTE os mesmos status/mensagens da rota
 * DELETE, servindo como fonte única de verdade — fácil de testar e de auditar.
 */

export interface DeletionTarget {
  email: string;
  role: string;
}

export interface DeletionContext {
  /** O autor da requisição é admin (raiz via env ou promovido no banco)? */
  callerIsAdmin: boolean;
  /** O autor é admin raiz (definido por env)? Raiz não pode se autodeletar. */
  callerIsRootAdmin: boolean;
  /** E-mail confiável do autor, resolvido no servidor (ou null). */
  callerEmail: string | null;
  /** Usuário alvo da deleção, ou null se não existe no banco. */
  target: DeletionTarget | null;
  /** Quantidade atual de admins no sistema (para proteger o último). */
  adminCount: number;
}

export type DeletionDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function evaluateUserDeletion(ctx: DeletionContext): DeletionDecision {
  // 1. Apenas admin pode deletar (checado antes de qualquer acesso ao banco).
  if (!ctx.callerIsAdmin) {
    return { ok: false, status: 403, error: "Sem permissão" };
  }

  // 2. O alvo precisa existir.
  if (!ctx.target) {
    return { ok: false, status: 404, error: "Usuário não encontrado" };
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
