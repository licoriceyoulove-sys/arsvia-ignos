// src/api/client.ts

// 1) API_BASE を正規化（末尾スラッシュ除去）
const RAW_BASE = import.meta.env.VITE_API_BASE || "/api";
export const API_BASE = (RAW_BASE as string).replace(/\/$/, "");
console.log("VITE_API_BASE =", API_BASE);
import type { QuizRowFromApi } from "./mapper";

// 共通: fetch 失敗時にサーバの応答も添えて投げる
const assertOk = async (res: Response, label: string) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${text}`);
  }
};

/* =========================================
   認証まわり
========================================= */
export async function login(params: { id: string; password: string }) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    credentials: "include",
  });
  await assertOk(res, "login");
  return res.json() as Promise<{
    ok: boolean;
    user: { id: string; name: string } | null;
  }>;
}

export async function logout() {
  const res = await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
  await assertOk(res, "logout");
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  await assertOk(res, "getMe");
  return res.json() as Promise<{
    authed: boolean;
    user: { id: string; name: string } | null;
  }>;
}

/* =========================================
   クイズ/フィード
========================================= */
export async function getQuizzes(viewerId?: number) {
  const param =
    viewerId && viewerId > 0
      ? `?viewer_id=${encodeURIComponent(String(viewerId))}`
      : "";
  const res = await fetch(`${API_BASE}/quizzes${param}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`getQuizzes failed: ${res.status}`);
  }
  return res.json();
}

// ★ 追加：プロフィール用「特定ユーザーのクイズ一覧」
export async function getUserQuizzes(
  userId: number
): Promise<QuizRowFromApi[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/quizzes`, {
    cache: "no-store",
    credentials: "include",
  });
  await assertOk(res, "getUserQuizzes");
  return res.json() as Promise<QuizRowFromApi[]>;
}

export async function bulkUpsertQuizzes(rows: any[]) {
  const res = await fetch(`${API_BASE}/quizzes/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
    credentials: "include",
  });
  await assertOk(res, "bulkUpsertQuizzes");
}

export type UserSearchResult = {
  id: number;
  display_name: string | null;
  ignos_id: string | null;
};

export const searchUsers = async (keyword: string): Promise<UserSearchResult[]> => {
  const q = keyword.trim();
  if (!q) return [];

  const res = await fetch(
    `${API_BASE}/users/search?q=${encodeURIComponent(q)}`,
    { credentials: "include" }
  );

  if (!res.ok) {
    throw new Error("ユーザー検索 API エラー");
  }

  const json = await res.json();
  return (json.users ?? []) as UserSearchResult[];
};
export async function postFeed(item: any) {
  const res = await fetch(`${API_BASE}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
    credentials: "include",
  });
  await assertOk(res, "postFeed");
}

/**
 * PATCH /feed/{id}
 * サーバ側は { field: "likes" | "retweets" | "answers" } を受け取り、そのカラムを +1 する実装想定。
 */
export async function patchFeed(
  id: string,
  field: "likes" | "retweets" | "answers"
) {
  const res = await fetch(`${API_BASE}/feed/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field }),
    credentials: "include",
  });
  await assertOk(res, "patchFeed");
}

/* =========================================
   ヘルスチェック（任意）
========================================= */
export async function ping() {
  const res = await fetch(`${API_BASE}/ping`, {
    credentials: "include",
  });
  await assertOk(res, "ping");
  return res.json();
}

export async function dbPing() {
  const res = await fetch(`${API_BASE}/db-ping`, {
    credentials: "include",
  });
  await assertOk(res, "dbPing");
  return res.json();
}

/* =========================================
   フォロー
========================================= */
export async function getFollows() {
  const res = await fetch(`${API_BASE}/follows`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  await assertOk(res, "getFollows");
  return res.json() as Promise<{
    authed: boolean;
    user_id?: number;
    follows: number[];
  }>;
}
