import { auth } from "@/lib/firebase/client";
import type { AppUser, CreateUserInput, UpdateUserInput } from "@/types/user";

export interface PaginatedUsers {
  data: AppUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

async function authFetch(input: string, init: RequestInit = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  // DELETE retorna { ok: true }; os demais retornam o recurso
  return res.status === 204 ? null : res.json();
}

export const usersApi = {
  list: (page = 1, limit = 50): Promise<PaginatedUsers> =>
    authFetch(`/api/users?page=${page}&limit=${limit}`),
  create: (data: CreateUserInput): Promise<AppUser> =>
    authFetch("/api/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: UpdateUserInput): Promise<AppUser> =>
    authFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string): Promise<{ ok: true }> =>
    authFetch(`/api/users/${id}`, { method: "DELETE" }),
};
