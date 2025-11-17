// resources/js/utils/user.ts

// window.Ignos の型定義（すでにどこかで書いていたらそちらを移動）
declare global {
  interface Window {
    Ignos?: {
      userId: number;
      name?: string;
    };
  }
}

// ログイン中ユーザーID（未ログインは 0 扱い）
export const CURRENT_USER_ID = window.Ignos?.userId ?? 0;

// 表示用ユーザー名（簡易版）
// 本番では API から取得したユーザー情報に差し替え予定
export const getUserDisplayName = (id?: number | null) => {
  if (!id || id === 0) return "ゲスト";
  if (id === CURRENT_USER_ID && window.Ignos?.name) return window.Ignos.name;
  return `ユーザー${id}`;
};

export const getUserScreenName = (id?: number | null) => {
  if (!id || id === 0) return "guest";
  return `user${id}`;
};
