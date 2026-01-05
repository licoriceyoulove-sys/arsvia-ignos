// src/api/client.ts

// 1) API_BASE を正規化（末尾スラッシュ除去）
const RAW_BASE = import.meta.env.VITE_API_BASE || "/api";
export const API_BASE = (RAW_BASE as string).replace(/\/$/, "");
console.log("VITE_API_BASE =", API_BASE);

import type { QuizRowFromApi } from "./mapper";
import axios from "axios";
import type { Visibility, FeedItem } from "../types/quiz";
// NOTE: セッション方式に統一するので API_TOKEN は使いません（残っていてもOK）
import { API_TOKEN } from "../utils/user";

/**
 * セッション方式のため Authorization は付けない。
 * ただしヘッダ合成を統一する目的で関数は残す。
 */
function authHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    ...Object.fromEntries(Object.entries(extra)),
  };
}

/**
 * Blade 側に <meta name="csrf-token" content="{{ csrf_token() }}"> がある前提。
 * PATCH/POST/DELETE など「状態変更」系リクエストに付ける。
 */
function csrfHeader(): Record<string, string> {
  const token = document
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute("content");
  return token ? { "X-CSRF-TOKEN": token } : {};
}

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
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅ 追加（ログインもPOSTなので付ける）
    }),
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
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅
    }),
    credentials: "include",
  });
  await assertOk(res, "logout");
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
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
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getQuizzes failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ★ 追加：プロフィール用「特定ユーザーのクイズ一覧」
export async function getUserQuizzes(userId: number): Promise<QuizRowFromApi[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/quizzes`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
  });
  await assertOk(res, "getUserQuizzes");
  return res.json() as Promise<QuizRowFromApi[]>;
}

export async function bulkUpsertQuizzes(rows: any[]) {
  const res = await fetch(`${API_BASE}/quizzes/bulk`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅
    }),
    body: JSON.stringify(rows),
    credentials: "include",
  });
  await assertOk(res, "bulkUpsertQuizzes");
}

export async function updateQuizVisibility(
  id: string,
  visibility: Visibility
): Promise<void> {
  const res = await fetch(`${API_BASE}/quizzes/${id}/visibility`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅
    }),
    credentials: "include",
    body: JSON.stringify({ visibility }),
  });
  await assertOk(res, "updateQuizVisibility");
}

export type UserSearchResult = {
  id: number;
  display_name: string | null;
  ignos_id: string | null;
};

export const searchUsers = async (
  keyword: string
): Promise<UserSearchResult[]> => {
  const q = keyword.trim();
  if (!q) return [];

  const res = await fetch(
    `${API_BASE}/users/search?q=${encodeURIComponent(q)}`,
    {
      credentials: "include",
      headers: authHeaders({
        "X-Requested-With": "XMLHttpRequest",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ユーザー検索 API エラー: ${res.status} ${text}`);
  }

  const json = await res.json();
  return (json.users ?? []) as UserSearchResult[];
};

export async function postFeed(item: any) {
  const res = await fetch(`${API_BASE}/feed`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅
    }),
    body: JSON.stringify(item),
    credentials: "include",
  });
  await assertOk(res, "postFeed");
}

export async function patchFeed(
  id: string,
  field: "likes" | "retweets" | "answers"
): Promise<
  | { ok: true; reacted: boolean; likes: number; retweets: number }
  | { ok: true; answers: number }
> {
  const res = await fetch(`${API_BASE}/feed/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅ ここが 419 の本丸
    }),
    credentials: "include",
    body: JSON.stringify({ field }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("patchFeed failed", {
      status: res.status,
      body: text,
      id,
      field,
      // 互換のため残してるがセッション方式では通常 false/未使用でOK
      hasToken: !!API_TOKEN,
    });
    throw new Error(`patchFeed failed: ${res.status} ${text}`);
  }
  return await res.json();
}

export async function deleteQuizzes(ids: string[]): Promise<void> {
  if (!ids.length) return;

  const res = await fetch(`${API_BASE}/quizzes/bulk-delete`, {
    method: "POST", // 既存実装に合わせる
    headers: authHeaders({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeader(), // ✅
    }),
    credentials: "include",
    body: JSON.stringify({ ids }),
  });

  await assertOk(res, "deleteQuizzes");
}

/* =========================================
   ヘルスチェック（任意）
========================================= */
export async function ping() {
  const res = await fetch(`${API_BASE}/ping`, {
    credentials: "include",
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
  });
  await assertOk(res, "ping");
  return res.json();
}

export async function dbPing() {
  const res = await fetch(`${API_BASE}/db-ping`, {
    credentials: "include",
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
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
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
  });
  await assertOk(res, "getFollows");
  return res.json() as Promise<{
    authed: boolean;
    user_id?: number;
    follows: number[];
  }>;
}

/* =========================================
   カテゴリ
========================================= */
export type CategoryLarge = {
  id: number;
  name_jp: string;
  name_en: string | null;
  description: string | null;
};

export type CategoryMiddle = {
  id: number;
  large_id: number;
  name_jp: string;
  name_en: string | null;
  description: string | null;
};

export type CategorySmall = {
  id: number;
  middle_id: number;
  code: string;
  name_jp: string;
  name_en: string | null;
  description: string | null;
};

// 追加：大カテゴリ一覧取得
export const getCategoryLarges = async (): Promise<CategoryLarge[]> => {
  // axios は withCredentials を付けないと cookie が飛ばないので注意
  const res = await axios.get(`${API_BASE}/category-larges`, {
    withCredentials: true,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  return res.data as CategoryLarge[];
};

export const getCategoryMiddles = async (): Promise<CategoryMiddle[]> => {
  const res = await axios.get(`${API_BASE}/category-middles`, {
    withCredentials: true,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  return res.data as CategoryMiddle[];
};

export async function getCategorySmalls(): Promise<CategorySmall[]> {
  const res = await axios.get(`${API_BASE}/category-smalls`, {
    withCredentials: true,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  return res.data as CategorySmall[];
}

// 全ユーザーの visibility=3（グローバル）クイズを取得
export const getGlobalQuizzes = async (): Promise<QuizRowFromApi[]> => {
  const res = await axios.get<QuizRowFromApi[]>(`${API_BASE}/quizzes/global`, {
    withCredentials: true,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  return res.data;
};

/* =========================================
   フィード取得
========================================= */
export async function getFeed(): Promise<FeedItem[]> {
  const res = await fetch(`${API_BASE}/feed`, {
    credentials: "include",
    headers: authHeaders({
      "X-Requested-With": "XMLHttpRequest",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getFeed failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  return (json as any[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    data: row.data,
    createdAt: new Date(row.createdAt).getTime(),
    likes: row.likes ?? 0,
    retweets: row.retweets ?? 0,
    answers: row.answers ?? 0,
  }));
}
