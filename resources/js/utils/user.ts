// resources/js/utils/user.ts

// Ignos 用の型を定義しておくと他でも使いやすい
export type IgnosBootstrap = {
  userId: number;
  name?: string;
  ignosId?: string;
  accountLevel?: number;
  apiToken?: string | null;
};

// window.Ignos の型定義（グローバルはここだけ）
declare global {
  interface Window {
    Ignos?: IgnosBootstrap;
  }
}

// 1回だけ取り出して使い回す
const bootstrap: IgnosBootstrap = window.Ignos ?? {
  userId: 0,
  accountLevel: 2,
  apiToken: null,
};

// ログイン中ユーザーID（未ログインは 0 扱い）
export const CURRENT_USER_ID = bootstrap.userId ?? 0;

// アカウントレベル（1:管理者, 2:通常, 3:学割）
export const ACCOUNT_LEVEL: number = bootstrap.accountLevel ?? 2;

// 管理者フラグ
export const IS_ADMIN: boolean = ACCOUNT_LEVEL === 1;

// ← ★ これを client.ts から使う
export const API_TOKEN: string | null = bootstrap.apiToken ?? null;

// 表示用ユーザー名（簡易版）
export const getUserDisplayName = (id?: number | null) => {
  if (!id || id === 0) return "ゲスト";
  if (id === CURRENT_USER_ID && bootstrap.name) return bootstrap.name;
  return `ユーザー${id}`;
};

export const getUserScreenName = (id?: number | null) => {
  if (!id || id === 0) return "guest";
  return `user${id}`;
};

export const getCurrentUserIgnosId = (): string | null => {
  return bootstrap.ignosId ?? null;
};

// 投稿ごとに付いてくる authorDisplayName を優先して表示する。
export const pickDisplayName = (
  authorDisplayName?: string | null,
  fallbackId?: number | null
): string => {
  if (authorDisplayName && authorDisplayName.trim().length > 0) {
    return authorDisplayName; // DB の display_name を使用
  }

  if (!fallbackId || fallbackId === 0) return "ゲスト";

  return `ユーザー${fallbackId}`;
};
