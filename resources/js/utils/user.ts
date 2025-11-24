// // resources/js/utils/user.ts

// // window.Ignos の型定義（すでにどこかで書いていたらそちらを移動）
declare global {
  interface Window {
    Ignos?: {
      userId: number;
      name?: string;
      ignosId?: string;
      accountLevel?: number;
    };
  }
}

// ログイン中ユーザーID（未ログインは 0 扱い）
export const CURRENT_USER_ID = window.Ignos?.userId ?? 0;
// アカウントレベル（1:管理者, 2:通常, 3:学割）
export const ACCOUNT_LEVEL: number = window.Ignos?.accountLevel ?? 2;
// 管理者フラグ
export const IS_ADMIN: boolean = ACCOUNT_LEVEL === 1;

// // 表示用ユーザー名（簡易版）
// // 本番では API から取得したユーザー情報に差し替え予定
export const getUserDisplayName = (id?: number | null) => {
  if (!id || id === 0) return "ゲスト";
  if (id === CURRENT_USER_ID && window.Ignos?.name) return window.Ignos.name;
  return `ユーザー${id}`;
};

export const getUserScreenName = (id?: number | null) => {
  if (!id || id === 0) return "guest";
  return `user${id}`;
};

export const getCurrentUserIgnosId = (): string | null => {
  return window.Ignos?.ignosId ?? null;
};

// 投稿ごとに付いてくる authorDisplayName を優先して表示する。
export const pickDisplayName = (
  authorDisplayName?: string | null,
  fallbackId?: number | null
): string => {
  if (authorDisplayName && authorDisplayName.trim().length > 0) {
    return authorDisplayName; // DB の display_name を使用
  }

  // display_name が無い場合
  if (!fallbackId || fallbackId === 0) return "ゲスト";

  // フォールバック：ユーザーIDベース
  return `ユーザー${fallbackId}`;
};
