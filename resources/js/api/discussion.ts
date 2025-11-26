// resources/js/api/discussion.ts

import axios from "axios";
import { API_BASE } from "./client";
import type {
  DiscussionSummary,
  DiscussionDetail,
  DiscussionOpinion,
  OpinionVoteStats,
  VoteKind,
} from "../types/discussion";

// -----------------------------
// APIレスポンス用の内部型
// （snake_case → camelCase に変換用）
// -----------------------------

type DiscussionSummaryFromApi = {
  id: number;
  title: string;
  agenda: string;
  tags?: string[];
  author_display_name?: string | null;
  author_ignos_id?: string | null;
  created_at: string;
};

type OpinionStatsFromApi = {
  visible: boolean;
  agree: number;
  disagree: number;
  pass: number;
  total: number;
  my_vote: VoteKind | null;
};

type DiscussionOpinionFromApi = {
  id: number;
  body: string;
  author_display_name?: string | null;
  author_ignos_id?: string | null;
  created_at: string;
  stats: OpinionStatsFromApi;
};

type DiscussionDetailFromApi = {
  id: number;
  title: string;
  agenda: string;
  tags: string[];
  author_display_name?: string | null;
  author_ignos_id?: string | null;
  created_at: string;
  opinions: DiscussionOpinionFromApi[];
};

// -----------------------------
// マッピング関数
// -----------------------------

const mapSummaryFromApi = (d: DiscussionSummaryFromApi): DiscussionSummary => ({
  id: d.id,
  title: d.title,
  agenda: d.agenda,
  tags: d.tags ?? [],
  authorDisplayName: d.author_display_name ?? null,
  authorIgnosId: d.author_ignos_id ?? null,
  createdAt: d.created_at,
});

const mapOpinionStatsFromApi = (s: OpinionStatsFromApi): OpinionVoteStats => ({
  visible: s.visible,
  agree: s.agree,
  disagree: s.disagree,
  pass: s.pass,
  total: s.total,
  myVote: s.my_vote,
});

const mapOpinionFromApi = (o: DiscussionOpinionFromApi): DiscussionOpinion => ({
  id: o.id,
  body: o.body,
  authorDisplayName: o.author_display_name ?? null,
  authorIgnosId: o.author_ignos_id ?? null,
  createdAt: o.created_at,
  stats: mapOpinionStatsFromApi(o.stats),
});

const mapDetailFromApi = (d: DiscussionDetailFromApi): DiscussionDetail => ({
  id: d.id,
  title: d.title,
  agenda: d.agenda,
  tags: d.tags ?? [],
  authorDisplayName: d.author_display_name ?? null,
  authorIgnosId: d.author_ignos_id ?? null,
  createdAt: d.created_at,
  opinions: (d.opinions ?? []).map(mapOpinionFromApi),
});

// -----------------------------
// 公開API
// -----------------------------

/**
 * 議論一覧の取得（キーワード検索付き）
 * GET /api/discussions?keyword=...
 */
export const fetchDiscussions = async (
  keyword?: string
): Promise<DiscussionSummary[]> => {
  const res = await axios.get<DiscussionSummaryFromApi[]>(
    `${API_BASE}/discussions`,
    {
      params: keyword ? { keyword } : undefined,
    }
  );

  return res.data.map(mapSummaryFromApi);
};

/**
 * 議論詳細の取得（アジェンダ＋意見一覧＋投票状況）
 * GET /api/discussions/{id}
 */
export const fetchDiscussionDetail = async (
  id: number
): Promise<DiscussionDetail> => {
  const res = await axios.get<DiscussionDetailFromApi>(
    `${API_BASE}/discussions/${id}`
  );

  return mapDetailFromApi(res.data);
};

/**
 * 議題の新規作成
 * POST /api/discussions
 *
 * @param payload { title, agenda, tags }
 */
export const createDiscussion = async (payload: {
  title: string;
  agenda: string;
  tags: string[];
}): Promise<DiscussionSummary> => {
  const res = await axios.post<DiscussionSummaryFromApi>(
    `${API_BASE}/discussions`,
    payload
  );

  return mapSummaryFromApi(res.data);
};

/**
 * 意見の新規投稿
 * POST /api/discussions/{discussionId}/opinions
 *
 * @param discussionId 対象の議題ID
 * @param payload { body }
 */
export const createOpinion = async (
  discussionId: number,
  payload: { body: string }
): Promise<DiscussionOpinion> => {
  const res = await axios.post<DiscussionOpinionFromApi>(
    `${API_BASE}/discussions/${discussionId}/opinions`,
    payload
  );

  return mapOpinionFromApi(res.data);
};

/**
 * 意見への投票（賛成/反対/パス）
 * POST /api/discussions/opinions/{opinionId}/vote
 *
 * 返り値は今は { ok: true } 程度なので、型は any にしておき、
 * 呼び出し側で fetchDiscussionDetail を叩き直す想定。
 */
export const voteOpinion = async (
  opinionId: number,
  vote: VoteKind
): Promise<void> => {
  await axios.post(`${API_BASE}/discussions/opinions/${opinionId}/vote`, {
    vote,
  });
};
