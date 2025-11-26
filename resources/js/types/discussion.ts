// resources/js/types/discussion.ts

// 賛成 / 反対 / パス の3種類
export type VoteKind = "agree" | "disagree" | "pass";

// 各意見に対する投票集計情報
export type OpinionVoteStats = {
  visible: boolean;              // 投票結果を表示してよいか（自分が投票済みかどうか）
  agree: number;                 // 賛成票数
  disagree: number;              // 反対票数
  pass: number;                  // パス票数
  total: number;                 // 合計票数（agree + disagree + pass）
  myVote: VoteKind | null;       // ログイン中ユーザーの投票内容（未投票なら null）
};

// 一覧で使う議題サマリ
export type DiscussionSummary = {
  id: number;
  title: string;
  agenda: string;
  tags: string[];
  authorDisplayName?: string | null;
  authorIgnosId?: string | null;
  createdAt: string; // ISO 文字列
};

// 各意見（詳細画面用）
export type DiscussionOpinion = {
  id: number;
  body: string;
  authorDisplayName?: string | null;
  authorIgnosId?: string | null;
  createdAt: string;
  stats: OpinionVoteStats; // ★ POLIS 風投票集計
};

// 議題詳細（意見一覧を含む）
export type DiscussionDetail = {
  id: number;
  title: string;
  agenda: string;
  tags: string[];
  authorDisplayName?: string | null;
  authorIgnosId?: string | null;
  createdAt: string;
  opinions: DiscussionOpinion[];
};
