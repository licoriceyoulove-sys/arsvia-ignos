// resources/js/components/home/HomeFeedScreen.tsx
import React from "react";
import type {
    FeedItem,
    FeedQuizBundleItem,
    QuizPost,
    Visibility,
    SharePost,
} from "../../types/quiz";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";
import { QuizPostCard } from "../ui/QuizPostCard";
import { TagChip } from "../ui/TagChip";
import { ActionBar } from "../ui/ActionBar";
import { VisibilityIcon } from "../ui/VisibilityIcon";
import { pickDisplayName, getCurrentUserIgnosId } from "../../utils/user";

type Props = {
    feed: FeedItem[];
    thanksFeedIds: string[];
    retweetedFeedIds: string[];
    currentUserId: number | null | undefined;
    onAnswerSingle: (post: QuizPost, feedId: string) => void;
    onAnswerBundle: (posts: QuizPost[], feedId: string) => void;
    onLike: (feedId: string) => void;
    onRT: (feedId: string) => void;
    onToggleMark: (feedId: string) => void;
    onEditFeedItem: (item: FeedItem) => void;
    onOpenProfile: (userId: number | null | undefined) => void;
    onTagClick: (tag: string) => void;
    onClickVisibility: (quizId: string, visibility?: Visibility | null) => void;
};

// 日付フォーマット（元の QuizApp から移設）
const formatDateYMD = (ts: number) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
};

export const HomeFeedScreen: React.FC<Props> = ({
    feed,
    thanksFeedIds,
    retweetedFeedIds,
    currentUserId,
    onAnswerSingle,
    onAnswerBundle,
    onLike,
    onRT,
    onToggleMark,
    onEditFeedItem,
    onOpenProfile,
    onTagClick,
    onClickVisibility,
}) => {
    const visibleFeed = feed;

    return (
        <Card>
            <SectionTitle title="" />
            <div className="px-4 pb-4">
                {visibleFeed.length === 0 && (
                    <div className="text-gray-500 text-sm">
                        まだ投稿がありません。「投稿」から作成してみましょう。
                    </div>
                )}

                {visibleFeed.map((item) => (
                    <div
                        key={item.id}
                        className="py-1 border-b border-gray-200 last:border-b-0"
                    >
                        {item.kind === "quiz" ? (
                            <QuizPostCard
                                post={item.data}
                                feedId={item.id}
                                likes={item.likes}
                                retweets={item.retweets}
                                answers={item.answers}
                                isMarked={(item as any).isMarked ?? false}
                                createdAtOverride={item.createdAt}
                                onAnswer={() =>
                                    onAnswerSingle(item.data, item.id)
                                }
                                onLike={() => onLike(item.id)}
                                onRT={() => onRT(item.id)}
                                isLiked={thanksFeedIds.includes(item.id)}
                                isRetweeted={retweetedFeedIds.includes(item.id)}
                                onToggleMark={() => onToggleMark(item.id)}
                                isMine={item.data.author_id === currentUserId}
                                onEdit={
                                    item.data.author_id === currentUserId
                                        ? () => onEditFeedItem(item)
                                        : undefined
                                }
                                onOpenProfile={(authorId) => {
                                    // authorId は number | string | null | undefined の可能性があるので number に寄せる
                                    const numericId =
                                        authorId == null
                                            ? null
                                            : Number(authorId);
                                    onOpenProfile(
                                        Number.isNaN(numericId as number)
                                            ? null
                                            : numericId
                                    );
                                }}
                                onTagClick={(tag) => onTagClick(tag)}
                                visibility={item.data.visibility}
                                onClickVisibility={() =>
                                    onClickVisibility(
                                        item.data.id,
                                        item.data.visibility
                                    )
                                }
                            />
                        ) : item.kind === "quizBundle" ? (
                            (() => {
                                const bundleItem = item as FeedQuizBundleItem;
                                const first = bundleItem.data[0];

                                const displayName = pickDisplayName(
                                    first?.authorDisplayName,
                                    first?.author_id
                                );

                                const ignosId =
                                    first?.authorIgnosId ??
                                    (first?.author_id === currentUserId &&
                                        getCurrentUserIgnosId()) ??
                                    (first?.author_id
                                        ? String(first.author_id)
                                        : "guest");

                                // このまとめ投稿に含まれるタグをすべて集約（重複削除）
                                const bundleTags = Array.from(
                                    new Set(
                                        bundleItem.data.flatMap(
                                            (q) => q.hashtags ?? []
                                        )
                                    )
                                );
                                const mainBundleTag = bundleTags[0];
                                const hasMoreBundleTags = bundleTags.length > 1;

                                // 先頭タグからまとめタイトルを作る（なければ1問目）
                                const mainTag = first?.hashtags?.[0];
                                const bundleTitle =
                                    mainTag != null && mainTag !== ""
                                        ? `${mainTag}に関する問題`
                                        : first?.question ?? "クイズ（複数）";

                                const handleAnswer = () => {
                                    onAnswerBundle(
                                        bundleItem.data,
                                        bundleItem.id
                                    );
                                };

                                return (
                                    <>
                                        {/* ユーザー情報ヘッダー */}
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const numericId =
                                                        first?.author_id == null
                                                            ? null
                                                            : Number(
                                                                  first.author_id
                                                              );
                                                    onOpenProfile(
                                                        Number.isNaN(
                                                            numericId as number
                                                        )
                                                            ? null
                                                            : numericId
                                                    );
                                                }}
                                                className="flex items-center gap-2"
                                            >
                                                <div className="w-9 h-9 rounded-full bg-gray-300" />
                                                <div className="flex flex-col items-start">
                                                    <span className="text-sm font-bold">
                                                        {displayName}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        @{ignosId}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>

                                        {/* タグ＋公開範囲 */}
                                        {(mainBundleTag ||
                                            first?.visibility != null) && (
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1 max-w-[70%] overflow-hidden whitespace-nowrap">
                                                    {mainBundleTag && (
                                                        <TagChip
                                                            key={
                                                                mainBundleTag +
                                                                bundleItem.id
                                                            }
                                                            tag={mainBundleTag}
                                                            onClick={() =>
                                                                onTagClick(
                                                                    mainBundleTag
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    {hasMoreBundleTags && (
                                                        <span className="text-xs text-gray-500 align-middle">
                                                            …
                                                        </span>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    className="ml-2 flex-shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!first) return;
                                                        onClickVisibility(
                                                            first.id,
                                                            first.visibility ??
                                                                null
                                                        );
                                                    }}
                                                >
                                                    <VisibilityIcon
                                                        value={
                                                            first.visibility ??
                                                            null
                                                        }
                                                    />
                                                </button>
                                            </div>
                                        )}

                                        {/* タイトル＋問題数（タップで回答開始） */}
                                        <div
                                            className="text-[15px] whitespace-pre-wrap mb-2 cursor-pointer"
                                            onClick={handleAnswer}
                                        >
                                            {bundleTitle}
                                        </div>
                                        <div
                                            className="text-xs text-gray-500 mb-2 cursor-pointer"
                                            onClick={handleAnswer}
                                        >
                                            全{bundleItem.data.length}問
                                        </div>

                                        <ActionBar
                                            likes={bundleItem.likes}
                                            retweets={bundleItem.retweets}
                                            answers={bundleItem.answers}
                                            onLike={() => onLike(bundleItem.id)}
                                            onRT={() => onRT(bundleItem.id)}
                                            onAnswer={handleAnswer}
                                            isMarked={
                                                bundleItem.isMarked ?? false
                                            }
                                            onToggleMark={() =>
                                                onToggleMark(bundleItem.id)
                                            }
                                            isMine={
                                                first?.author_id ===
                                                currentUserId
                                            }
                                            onEdit={
                                                first?.author_id ===
                                                currentUserId
                                                    ? () =>
                                                          onEditFeedItem(
                                                              bundleItem
                                                          )
                                                    : undefined
                                            }
                                            createdAtText={formatDateYMD(
                                                bundleItem.createdAt
                                            )}
                                        />
                                    </>
                                );
                            })()
                        ) : item.kind === "share" ? (
                            (() => {
                                const shareItem = item as unknown as SharePost;
                                return (
                                    <>
                                        <div className="text-[15px] whitespace-pre-wrap mb-2">
                                            {shareItem.message}
                                        </div>
                                        <div className="mb-2">
                                            <button
                                                onClick={() =>
                                                    onTagClick(shareItem.tag)
                                                }
                                                className="px-3 py-1 rounded-full bg-black text-white text-sm"
                                            >
                                                クイズリンクを開く
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(
                                                shareItem.createdAt
                                            ).toLocaleString()}{" "}
                                            ・ 共有
                                        </div>
                                        <ActionBar
                                            likes={shareItem.likes}
                                            retweets={shareItem.retweets}
                                            onLike={() => onLike(shareItem.id)}
                                            onRT={() => onRT(shareItem.id)}
                                        />
                                    </>
                                );
                            })()
                        ) : null}
                    </div>
                ))}
            </div>
        </Card>
    );
};
