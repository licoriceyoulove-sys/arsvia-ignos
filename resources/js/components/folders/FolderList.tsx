// resources/js/components/folder/FolderList.tsx （パスは例）
import React, { useMemo, useState } from "react";
import type { QuizPost } from "../../types/quiz";
import type {
  CategoryLarge,
  CategoryMiddle,
  CategorySmall,
} from "../../api/client";

import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";
import { TagChip } from "../ui/TagChip";

export const FolderList: React.FC<{
  posts: QuizPost[];
  onStartQuiz: (tag: string) => void;
  onShare: (tag: string) => void;
  categoryLarges: CategoryLarge[];
  categoryMiddles: CategoryMiddle[];
  categorySmalls: CategorySmall[];
}> = ({
  posts,
  onStartQuiz,
  onShare,
  categoryLarges = [],
  categoryMiddles,
  categorySmalls,
}) => {
  // 小カテゴリごとの tag 集計: key = category_tag
  const tagCountByCategoryTag = useMemo(() => {
    const result = new Map<string, [string, number][]>();

    // category_tag ごとに投稿をまとめる
    const postsByCat = new Map<string, QuizPost[]>();
    posts.forEach((p) => {
      const cat = p.category_tag ?? "";
      if (!cat) return;
      const list = postsByCat.get(cat) ?? [];
      list.push(p);
      postsByCat.set(cat, list);
    });

    // 各 category_tag ごとにタグ集計
    postsByCat.forEach((plist, cat) => {
      const map = new Map<string, number>();
      plist.forEach((p) => {
        (p.hashtags ?? []).forEach((t) =>
          map.set(t, (map.get(t) ?? 0) + 1)
        );
      });
      const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      result.set(cat, arr);
    });

    return result;
  }, [posts]);

  // 大 / 中 / 小 カテゴリの開閉状態
  const [openLargeId, setOpenLargeId] = useState<number | null>(null);
  const [openMiddleId, setOpenMiddleId] = useState<number | null>(null);
  const [openSmallId, setOpenSmallId] = useState<number | null>(null);

  return (
    <Card>
      <SectionTitle title="カテゴリから探す" />
      <div className="px-4 pb-4">
        {categoryLarges.length === 0 && (
          <div className="text-xs text-gray-500">
            大カテゴリマスタがまだ登録されていません。
          </div>
        )}

        <div className="space-y-2">
          {categoryLarges.map((large) => {
            const middles = categoryMiddles.filter(
              (m) => m.large_id === large.id
            );

            const isLargeOpen = openLargeId === large.id;

            return (
              <div
                key={large.id}
                className="rounded-xl border border-gray-200 bg-white"
              >
                {/* 大カテゴリ行：クリックで開閉 */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenLargeId((prev) =>
                      prev === large.id ? null : large.id
                    )
                  }
                  className="w-full flex items-center justify-between px-3 py-2"
                >
                  <div className="flex-1 text-left">
                    <div className="text-sm">{large.name_jp}</div>
                    {large.description && (
                      <div className="text-[11px] text-gray-500">
                        {large.description}
                      </div>
                    )}
                    {large.name_en && (
                      <div className="text-[11px] text-gray-400">
                        {large.name_en}
                      </div>
                    )}
                  </div>
                  <div className="ml-2 text-xs text-gray-500">
                    {isLargeOpen ? "－" : "＋"}
                  </div>
                </button>

                {/* ▼ 中カテゴリ + 小カテゴリ（大カテゴリが開いているときだけ） */}
                {isLargeOpen && (
                  <div className="border-t border-gray-100">
                    {middles.length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-gray-400">
                        この大カテゴリには中カテゴリがありません。
                      </div>
                    )}

                    {middles.map((mid) => {
                      const smalls = categorySmalls.filter(
                        (s) => s.middle_id === mid.id
                      );

                      const isMiddleOpen = openMiddleId === mid.id;

                      return (
                        <div
                          key={mid.id}
                          className="border-t border-gray-50"
                        >
                          {/* 中カテゴリ行：クリックで小カテゴリ一覧を開閉 */}
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMiddleId((prev) =>
                                prev === mid.id ? null : mid.id
                              )
                            }
                            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50"
                          >
                            <div className="flex-1 text-left">
                              <div className="text-sm">{mid.name_jp}</div>
                              {mid.description && (
                                <div className="text-[11px] text-gray-500">
                                  {mid.description}
                                </div>
                              )}
                              {mid.name_en && (
                                <div className="text-[11px] text-gray-400">
                                  {mid.name_en}
                                </div>
                              )}
                            </div>
                            <div className="ml-2 text-xs text-gray-500">
                              {isMiddleOpen ? "－" : "＋"}
                            </div>
                          </button>

                          {/* ▼ 小カテゴリ一覧（中カテゴリが開いているときだけ） */}
                          {isMiddleOpen && (
                            <div className="border-t border-gray-100">
                              {smalls.length === 0 && (
                                <div className="px-5 py-2 text-[11px] text-gray-400">
                                  この中カテゴリには小カテゴリがありません。
                                </div>
                              )}

                              {smalls.map((small) => {
                                const isSmallOpen =
                                  openSmallId === small.id;

                                // この小カテゴリの code を category_tag に持つ投稿のタグ一覧
                                const tagsForSmall =
                                  tagCountByCategoryTag.get(
                                    small.code
                                  ) ?? [];

                                return (
                                  <div
                                    key={small.id}
                                    className="px-5 py-2 border-t border-gray-50"
                                  >
                                    {/* 小カテゴリ行（クリックでタグ一覧を開閉） */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenSmallId((prev) =>
                                          prev === small.id
                                            ? null
                                            : small.id
                                        )
                                      }
                                      className="w-full flex items-center justify-between"
                                    >
                                      <div className="flex-1 text-left">
                                        <div className="text-sm">
                                          {small.name_jp}
                                        </div>
                                        {small.description && (
                                          <div className="text-[11px] text-gray-500">
                                            {small.description}
                                          </div>
                                        )}
                                        {small.name_en && (
                                          <div className="text-[11px] text-gray-400">
                                            {small.name_en}
                                          </div>
                                        )}
                                      </div>
                                      <div className="ml-2 text-xs text-gray-500">
                                        {isSmallOpen ? "▲" : "▼"}
                                      </div>
                                    </button>

                                    {/* ▼ この小カテゴリに紐づくタグ一覧 */}
                                    {isSmallOpen && (
                                      <div className="mt-2 pl-2 space-y-1">
                                        {tagsForSmall.length === 0 && (
                                          <div className="text-[11px] text-gray-400">
                                            この小カテゴリのタグ付き投稿はまだありません。
                                          </div>
                                        )}

                                        {tagsForSmall.map(
                                          ([tag, count]) => (
                                            <div
                                              key={tag}
                                              className="flex items-center gap-2"
                                            >
                                              <TagChip
                                                tag={`${tag}（${count}）`}
                                                onClick={() =>
                                                  onStartQuiz(tag)
                                                }
                                              />
                                              <button
                                                onClick={() =>
                                                  onStartQuiz(tag)
                                                }
                                                className="px-3 py-1 rounded-full text-xs bg-black text-white"
                                              >
                                                Answer
                                              </button>
                                              <button
                                                onClick={() =>
                                                  onShare(tag)
                                                }
                                                className="px-3 py-1 rounded-full text-xs border"
                                              >
                                                Look！
                                              </button>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
