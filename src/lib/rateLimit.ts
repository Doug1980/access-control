/**
 * Rate limiter in-memory por IP.
 * Adequado para single-instance (Vercel serverless, dev local).
 * Para multi-instância em produção, substituir pelo @upstash/ratelimit + Redis.
 */

interface RateLimitOptions {
  /** Número máximo de requisições permitidas na janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

// Map global sobrevive entre invocações na mesma instância Node.
const store = new Map<string, BucketEntry>();

// Limpeza periódica para não vazar memória.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);

function getIp(req: Request): string {
  // Vercel / proxies populam X-Forwarded-For.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Fallback para desenvolvimento local.
  return "127.0.0.1";
}

export function rateLimit(
  req: Request,
  options: RateLimitOptions,
): { ok: boolean } {
  const ip  = getIp(req);
  const key = `${ip}:${options.windowMs}:${options.limit}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  entry.count += 1;

  if (entry.count > options.limit) {
    return { ok: false };
  }

  return { ok: true };
}
