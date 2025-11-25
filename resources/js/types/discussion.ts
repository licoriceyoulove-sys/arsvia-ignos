// resources/js/types/discussion.ts
export type DiscussionSummary = {
  id: number;
  title: string;
  agenda: string;
  tags: string[];
  authorDisplayName?: string | null;
  authorIgnosId?: string | null;
  createdAt: string; // ISO文字列 or フロント側で number に変換してもOK
};

export type DiscussionChoice = {
  id: number;
  label: string;
  voteCount: number;
};

export type DiscussionOpinion = {
  id: number;
  body: string;
  authorDisplayName?: string | null;
  authorIgnosId?: string | null;
  createdAt: string;
  choices: DiscussionChoice[];
  totalVotes: number;
  myChoiceId?: number | null; // ログイン中ユーザーの選択肢
};

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
