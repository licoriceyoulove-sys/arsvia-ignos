// console.log(import.meta.env.VITE_API_BASE);

// // src/api/client.ts
// export const API_BASE = import.meta.env.VITE_API_BASE || "/api";
// console.log("VITE_API_BASE =", API_BASE);

// export async function getQuizzes() {
//   const res = await fetch(`${API_BASE}/quizzes`);
//   if (!res.ok) throw new Error("getQuizzes failed");
//   return res.json(); // ← 配列が返ってきます
// }

// export async function bulkUpsertQuizzes(rows: any[]) {
//   const r = await fetch(`${API_BASE}/quizzes/bulk`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(rows),
//   });
//   if (!r.ok) throw new Error("bulkUpsertQuizzes failed");
// }

// export async function postFeed(item: any) {
//   const r = await fetch(`${API_BASE}/feed`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(item),
//   });
//   if (!r.ok) throw new Error("postFeed failed");
// }

// export async function patchFeed(id: string, patch: any) {
//   const r = await fetch(`${API_BASE}/feed/${id}`, {
//     method: "PATCH",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(patch),
//   });
//   if (!r.ok) throw new Error("patchFeed failed");
// }
// src/api/client.ts

// 1) API_BASE を正規化（末尾スラッシュ除去）
const RAW_BASE = import.meta.env.VITE_API_BASE || "/api";
export const API_BASE = (RAW_BASE as string).replace(/\/$/, "");
console.log("VITE_API_BASE =", API_BASE);

// 共通: fetch 失敗時に少し情報を出す（任意）
const assertOk = async (res: Response, label: string) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${text}`);
  }
};

export async function getQuizzes() {
  const res = await fetch(`${API_BASE}/quizzes`, { cache: "no-store" });
  await assertOk(res, "getQuizzes");
  return res.json(); // 配列
}

export async function bulkUpsertQuizzes(rows: any[]) {
  const res = await fetch(`${API_BASE}/quizzes/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
  await assertOk(res, "bulkUpsertQuizzes");
}

export async function postFeed(item: any) {
  const res = await fetch(`${API_BASE}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  await assertOk(res, "postFeed");
}

/**
 * PATCH /feed/{id}
 * サーバ側は { field: "likes" | "retweets" | "answers" } を期待
 * QuizApp からは patchFeed(id, { likes: undefined }) で来るので、
 * ここで field を判定して送る
 */
export async function patchFeed(id: string, field: "likes"|"retweets"|"answers") {
  const r = await fetch(`${API_BASE}/feed/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field }), // ← どのカラムを +1 したいか明示
  });
  if (!r.ok) throw new Error("patchFeed failed");
}
