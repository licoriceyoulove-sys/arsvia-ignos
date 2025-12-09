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
import { ActionBar } from "../ui/ActionBar";

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
                onAnswer={() => onAnswerSingle(item.data, item.id)}
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
                  const numericId =
                    authorId == null ? null : Number(authorId);
                  onOpenProfile(
                    Number.isNaN(numericId as number) ? null : numericId
                  );
                }}
                onTagClick={(tag) => onTagClick(tag)}
                visibility={item.data.visibility}
                onClickVisibility={() =>
                  onClickVisibility(item.data.id, item.data.visibility)
                }
              />
            ) : item.kind === "quizBundle" ? (
              (() => {
                const bundleItem = item as FeedQuizBundleItem;
                const first = bundleItem.data[0];
                if (!first) return null;

                return (
                  <QuizPostCard
                    post={first}
                    feedId={bundleItem.id}
                    likes={bundleItem.likes}
                    retweets={bundleItem.retweets}
                    answers={bundleItem.answers}
                    isMarked={(bundleItem as any).isMarked ?? false}
                    createdAtOverride={bundleItem.createdAt}
                    // ★ まとめ投稿：回答するときは bundle 全体を渡す
                    onAnswer={() =>
                      onAnswerBundle(bundleItem.data, bundleItem.id)
                    }
                    onLike={() => onLike(bundleItem.id)}
                    onRT={() => onRT(bundleItem.id)}
                    isLiked={thanksFeedIds.includes(bundleItem.id)}
                    isRetweeted={retweetedFeedIds.includes(bundleItem.id)}
                    onToggleMark={() => onToggleMark(bundleItem.id)}
                    isMine={first.author_id === currentUserId}
                    onEdit={
                      first.author_id === currentUserId
                        ? () => onEditFeedItem(bundleItem)
                        : undefined
                    }
                    onOpenProfile={(authorId) => {
                      const numericId =
                        authorId == null ? null : Number(authorId);
                      onOpenProfile(
                        Number.isNaN(numericId as number) ? null : numericId
                      );
                    }}
                    onTagClick={(tag) => onTagClick(tag)}
                    visibility={first.visibility}
                    onClickVisibility={() =>
                      onClickVisibility(first.id, first.visibility)
                    }
                    // ★ QuizPostCard 側でまとめ投稿用に使う想定の追加 props
                    isBundle
                    bundlePosts={bundleItem.data}
                  />
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
                        onClick={() => onTagClick(shareItem.tag)}
                        className="px-3 py-1 rounded-full bg-black text-white text-sm"
                      >
                        クイズリンクを開く
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(shareItem.createdAt).toLocaleString()} ・ 共有
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
