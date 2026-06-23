/**
 * Validação de inputs da API — substituto leve do Zod.
 * Retorna { ok: true, data } ou { ok: false, error: string }.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "user"] as const;
type Role = (typeof ROLES)[number];

export interface ValidationOk<T> {
  ok: true;
  data: T;
}
export interface ValidationFail {
  ok: false;
  error: string;
}
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

export interface CreateUserData {
  name: string;
  email: string;
  role: Role;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateName(name: unknown): string | null {
  if (typeof name !== "string") return "Nome deve ser uma string";
  const trimmed = name.trim();
  if (trimmed.length < 2)   return "Nome deve ter no mínimo 2 caracteres";
  if (trimmed.length > 100) return "Nome deve ter no máximo 100 caracteres";
  return null; // válido
}

function validateEmail(email: unknown): string | null {
  if (typeof email !== "string") return "E-mail deve ser uma string";
  const trimmed = email.trim();
  if (trimmed.length > 255)     return "E-mail deve ter no máximo 255 caracteres";
  if (!EMAIL_RE.test(trimmed))  return "E-mail inválido";
  return null;
}

function validateRole(role: unknown): string | null {
  if (role !== undefined && !ROLES.includes(role as Role))
    return `Role deve ser "admin" ou "user"`;
  return null;
}

// ---------------------------------------------------------------------------
// Schemas públicos
// ---------------------------------------------------------------------------

export function validateCreateUser(body: unknown): ValidationResult<CreateUserData> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido" };
  }

  const b = body as Record<string, unknown>;

  const nameErr  = validateName(b.name);
  if (nameErr)  return { ok: false, error: nameErr };

  const emailErr = validateEmail(b.email);
  if (emailErr) return { ok: false, error: emailErr };

  const roleErr  = validateRole(b.role);
  if (roleErr)  return { ok: false, error: roleErr };

  return {
    ok: true,
    data: {
      name:  (b.name  as string).trim(),
      email: (b.email as string).trim().toLowerCase(),
      role:  (ROLES.includes(b.role as Role) ? b.role : "user") as Role,
    },
  };
}

export function validateUpdateUser(body: unknown): ValidationResult<UpdateUserData> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido" };
  }

  const b = body as Record<string, unknown>;
  const data: UpdateUserData = {};

  // Apenas campos explicitamente enviados são validados/aceitos (allowlist).
  if ("name" in b) {
    const err = validateName(b.name);
    if (err) return { ok: false, error: err };
    data.name = (b.name as string).trim();
  }

  if ("email" in b) {
    const err = validateEmail(b.email);
    if (err) return { ok: false, error: err };
    data.email = (b.email as string).trim().toLowerCase();
  }

  if ("role" in b) {
    const err = validateRole(b.role);
    if (err) return { ok: false, error: err };
    data.role = b.role as Role;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nenhum campo válido para atualizar" };
  }

  return { ok: true, data };
}
