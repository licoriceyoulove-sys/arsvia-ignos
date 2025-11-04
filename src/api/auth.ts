// src/api/auth.ts
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export type LoginResult = { ok: true; user: { id: string; name: string } };

export async function login(id: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // セッションCookieを受け取るため
    credentials: "include",
    body: JSON.stringify({ id, password }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "ログインに失敗しました");
  }
  return res.json();
}
