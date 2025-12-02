// resources/js/components/search/UserSearchScreen.tsx
import React, { useMemo, useEffect, useRef } from "react";
import type { UserSearchResult } from "../../api/client";
import type { QuizPost } from "../../types/quiz";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";
import { TagChip } from "../ui/TagChip";

type Props = {
  keyword: string;
  onChangeKeyword: (value: string) => void;
  searching: boolean;
  error: string | null;
  results: UserSearchResult[];
  onSearch: () => void;
  onSelectUser: (id: number) => void;
  posts: QuizPost[];
  onStartQuiz: (tag: string) => void;
  onShare: (tag: string) => void;
};

// タグ集計用
type TagStat = {
  tag: string;
  count: number;
  latest: number;
};

// 表示用（tag + count）
type TagView = {
  tag: string;
  count: number;
};

export const UserSearchScreen: React.FC<Props> = ({
  keyword,
  onChangeKeyword,
  searching,
  error,
  results,
  onSearch,
  onSelectUser,
  posts,
  onStartQuiz,
  onShare,
}) => {
  const trimmed = keyword.trim();
  const lastSearchedKeywordRef = useRef<string>("");
  useEffect(() => {
    // 空文字のときは検索しない（新着タグを出したいので）
    if (!trimmed) return;

    // すでにこのキーワードで検索済みなら何もしない
    if (lastSearchedKeywordRef.current === trimmed) return;

    // 今回のキーワードで検索して、ref を更新
    lastSearchedKeywordRef.current = trimmed;
    onSearch();
  }, [trimmed]);

  // 1. posts からタグ情報を集計（1回だけ）
  const tagStats = useMemo<TagStat[]>(() => {
    const map = new Map<string, { count: number; latest: number }>();

    posts.forEach((p) => {
      const ts =
        typeof p.createdAt === "number"
          ? p.createdAt
          : new Date(p.createdAt as any).getTime();

      (p.hashtags ?? []).forEach((t) => {
        const info = map.get(t);
        if (!info) {
          map.set(t, { count: 1, latest: ts });
        } else {
          info.count += 1;
          if (ts > info.latest) info.latest = ts;
        }
      });
    });

    return Array.from(map.entries()).map(([tag, info]) => ({
      tag,
      count: info.count,
      latest: info.latest,
    }));
  }, [posts]);

  // 2. 新着タグ20件（keyword が空のときにだけ表示）
  const newestTags = useMemo<TagView[]>(() => {
    return tagStats
      .slice()
      .sort((a, b) => b.latest - a.latest) // 最新順
      .slice(0, 20) // 上位20件
      .map(({ tag, count }) => ({ tag, count }));
  }, [tagStats]);

  // 3. タグ検索結果（keyword が空でないときに表示）
  const searchedTags = useMemo<TagView[]>(() => {
    if (!trimmed) return [];
    return tagStats
      .filter((t) => t.tag.includes(trimmed))
      .sort((a, b) => b.latest - a.latest)
      .map(({ tag, count }) => ({ tag, count }));
  }, [tagStats, trimmed]);

  return (
    <Card>
      <SectionTitle title="ユーザー検索" />
      <div className="px-4 pb-4 space-y-3">
        {/* 検索フォーム */}
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => onChangeKeyword(e.target.value)}
            placeholder="ユーザー名 / IgnosID / タグを検索"
            className="flex-1 px-3 py-2 border rounded-xl text-sm bg-gray-50 border-gray-200"
          />
          <button
            type="button"
            onClick={onSearch}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold"
          >
            検索
          </button>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}

        {searching && (
          <div className="text-sm text-gray-500">検索中です…</div>
        )}

        {/* ユーザー検索結果リスト */}
        <div className="divide-y divide-gray-200">
          {results.map((u) => {
            const displayName = u.display_name || "ゲスト";
            const ignosId = u.ignos_id || String(u.id);

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u.id)}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gray-300" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold">{displayName}</span>
                  <span className="text-xs text-gray-500">@{ignosId}</span>
                </div>
              </button>
            );
          })}

          {!searching && trimmed !== "" && results.length === 0 && (
            <div className="py-3 text-sm text-gray-500">
              該当するユーザーが見つかりませんでした。
            </div>
          )}
        </div>

        {/* ▼ keyword が空のときだけ、新着タグ20件を表示 */}
        {trimmed === "" && newestTags.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="text-sm font-bold">新着タグ</div>
            {newestTags.map(({ tag, count }) => (
              <div key={tag} className="flex items-center gap-2">
                <TagChip
                  tag={`${tag}（${count}）`}
                  onClick={() => onStartQuiz(tag)}
                />
                <button
                  onClick={() => onStartQuiz(tag)}
                  className="px-3 py-1 rounded-full text-sm bg-black text-white"
                >
                  Answer
                </button>
                <button
                  onClick={() => onShare(tag)}
                  className="px-3 py-1 rounded-full text-sm border"
                >
                  Look！
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ▼ keyword に入力があるときは、新着タグではなく「タグ検索結果」を表示 */}
        {trimmed !== "" && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="text-sm font-bold">タグ検索結果</div>

            {searchedTags.length === 0 && (
              <div className="text-sm text-gray-500">
                該当するタグが見つかりませんでした。
              </div>
            )}

            {searchedTags.map(({ tag, count }) => (
              <div key={tag} className="flex items-center gap-2">
                <TagChip
                  tag={`${tag}（${count}）`}
                  onClick={() => onStartQuiz(tag)}
                />
                <button
                  onClick={() => onStartQuiz(tag)}
                  className="px-3 py-1 rounded-full text-sm bg-black text-white"
                >
                  Answer
                </button>
                <button
                  onClick={() => onShare(tag)}
                  className="px-3 py-1 rounded-full text-sm border"
                >
                  Look！
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
