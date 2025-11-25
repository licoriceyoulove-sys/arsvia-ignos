// resources/js/api/discussion.ts
import axios from "axios";
import { API_BASE } from "./client";
import type {
  DiscussionSummary,
  DiscussionDetail,
  DiscussionOpinion,
} from "../types/discussion";

export type DiscussionSummaryFromApi = {
  id: number;
  title: string;
  agenda: string;
  tags: string[];
  author_display_name?: string | null;
  author_ignos_id?: string | null;
  created_at: string;
};

export type DiscussionDetailFromApi = DiscussionDetail & {
  opinions: (DiscussionOpinion & {
    // API都合でフィールド名が違う場合に合わせて拡張
  })[];
};

// 一覧 & 検索
export const fetchDiscussions = async (keyword?: string) => {
  const res = await axios.get<DiscussionSummaryFromApi[]>(
    `${API_BASE}/discussions`,
    { params: keyword ? { keyword } : undefined }
  );

  // 命名などをフロント用に揃える
  const list: DiscussionSummary[] = res.data.map((d) => ({
    id: d.id,
    title: d.title,
    agenda: d.agenda,
    tags: d.tags ?? [],
    authorDisplayName: d.author_display_name ?? undefined,
    authorIgnosId: d.author_ignos_id ?? undefined,
    createdAt: d.created_at,
  }));
  return list;
};

// 詳細
export const fetchDiscussionDetail = async (id: number, viewerId?: number) => {
  const res = await axios.get<DiscussionDetail>(
    `${API_BASE}/discussions/${id}`,
    { params: viewerId ? { viewer_id: viewerId } : undefined }
  );
  return res.data;
};

// 議題投稿
export const createDiscussion = async (payload: {
  title: string;
  agenda: string;
  tags: string[];
}) => {
  const res = await axios.post<DiscussionSummaryFromApi>(
    `${API_BASE}/discussions`,
    payload
  );
  return {
    id: res.data.id,
    title: res.data.title,
    agenda: res.data.agenda,
    tags: res.data.tags ?? [],
    authorDisplayName: res.data.author_display_name ?? undefined,
    authorIgnosId: res.data.author_ignos_id ?? undefined,
    createdAt: res.data.created_at,
  } as DiscussionSummary;
};

// 意見投稿
export const createOpinion = async (
  discussionId: number,
  payload: { body: string; choices: string[] }
) => {
  const res = await axios.post<DiscussionOpinion>(
    `${API_BASE}/discussions/${discussionId}/opinions`,
    payload
  );
  return res.data;
};

// 投票
export const voteOpinion = async (opinionId: number, choiceId: number) => {
  const res = await axios.post(
    `${API_BASE}/discussions/opinions/${opinionId}`,
    { choice_id: choiceId }
  );
  return res.data;
};
