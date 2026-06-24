import { getDb } from "@/lib/mongodb";

/**
 * Registro leve de exclusões — base para o limite diário do 'user' e um
 * mini-histórico de auditoria. Coleção: deletion_events.
 */

// Registra uma exclusão (best-effort: nunca derruba a requisição principal).
export async function recordDeletion(actorEmail: string, deletedId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection("deletion_events")
    .insertOne({
      actorEmail: actorEmail.toLowerCase(),
      deletedId,
      at: new Date(),
    })
    .catch(() => {});
}

// Conta quantas exclusões o autor fez dentro da janela (ms) até agora.
export async function countRecentDeletions(
  actorEmail: string,
  windowMs: number,
): Promise<number> {
  const db = await getDb();
  const since = new Date(Date.now() - windowMs);
  return db.collection("deletion_events").countDocuments({
    actorEmail: actorEmail.toLowerCase(),
    at: { $gte: since },
  });
}
