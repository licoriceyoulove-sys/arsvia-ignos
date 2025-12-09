// resources/js/api/discussion.ts

import axios from "axios";
import { API_BASE } from "./client";
import { API_TOKEN } from "../utils/user"; // ★ 追加

import type {
  DiscussionSummary,
  DiscussionDetail,
  DiscussionOpinion,
  OpinionVoteStats,
  VoteKind,
} from "../types/discussion";

// --------------------------------------------------
// axios クライアント（client）を定義
// --------------------------------------------------
const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// 共通ヘッダ付与（毎リクエスト）
client.interceptors.request.use((config) => {
  const h = config.headers;

  if (h && typeof h.set === "function") {
    h.set("X-Requested-With", "XMLHttpRequest");
    h.set("Content-Type", "application/json");

    if (API_TOKEN) {
      h.set("Authorization", `Bearer ${API_TOKEN}`);
    }
  }

  return config;
});

// -----------------------------
// APIレスポンス用の内部型
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
  const res = await client.get<DiscussionSummaryFromApi[]>("/discussions", {
    params: keyword ? { keyword } : undefined,
  });

  return res.data.map(mapSummaryFromApi);
};

/**
 * 議論詳細の取得（アジェンダ＋意見一覧＋投票状況）
 * GET /api/discussions/{id}
 */
export async function fetchDiscussionDetail(
  id: number
): Promise<DiscussionDetail> {
  const res = await client.get<DiscussionDetailFromApi>(`/discussions/${id}`);
  return mapDetailFromApi(res.data);
}

/**
 * 議題の新規作成
 * POST /api/discussions
 */
export async function createDiscussion(
  payload: { title: string; agenda: string; tags: string[] }
): Promise<DiscussionSummary> {
  const res = await client.post<DiscussionSummaryFromApi>("/discussions", {
    ...payload,
  });
  return mapSummaryFromApi(res.data);
}

/**
 * 意見の新規投稿
 * POST /api/discussions/{discussionId}/opinions
 */
export const createOpinion = async (
  discussionId: number,
  payload: { body: string }
): Promise<DiscussionOpinion> => {
  const res = await client.post<DiscussionOpinionFromApi>(
    `/discussions/${discussionId}/opinions`,
    payload
  );

  return mapOpinionFromApi(res.data);
};

/**
 * 意見への投票（賛成/反対/パス）
 * POST /api/discussions/opinions/{opinionId}/vote
 */
export const voteOpinion = async (
  opinionId: number,
  vote: VoteKind
): Promise<void> => {
  await client.post(`/discussions/opinions/${opinionId}/vote`, {
    vote,
  });
};
