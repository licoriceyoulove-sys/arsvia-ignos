// resources/js/components/feed/QuizPostCard.tsx
import React from "react";
import type { QuizPost } from "../../types/quiz";
import { TagChip } from "../ui/TagChip";
import { ActionBar } from "../ui/ActionBar";
import {
  CURRENT_USER_ID,
  pickDisplayName,
  getCurrentUserIgnosId,
} from "../../utils/user";

const formatDateYMD = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

type QuizPostCardProps = {
  // 表示する投稿
  post: QuizPost;

  // タイムライン用のカウンタ類（プロフィールでは 0 固定でもOK）
  feedId?: string;
  likes?: number;
  retweets?: number;
  answers?: number;

  // Mark 状態
  isMarked?: boolean;

  // 作成日時（feed の createdAt を使いたいとき用。省略時は post.createdAt）
  createdAtOverride?: number;

  // アクション系
  onAnswer: () => void;
  onLike?: () => void;
  onRT?: () => void;
  onToggleMark?: () => void;

  // 編集 & プロフィール遷移
  isMine?: boolean;
  onEdit?: () => void;
  onOpenProfile?: (authorId?: number | string | null) => void;

  // タグをタップしたとき（フォルダクイズ開始など）
  onTagClick?: (tag: string) => void;
};

export const QuizPostCard: React.FC<QuizPostCardProps> = ({
  post,
  likes = 0,
  retweets = 0,
  answers = 0,
  isMarked = false,
  createdAtOverride,
  onAnswer,
  onLike,
  onRT,
  onToggleMark,
  isMine,
  onEdit,
  onOpenProfile,
  onTagClick,
}) => {
  const displayName = pickDisplayName(
    post.authorDisplayName,
    post.author_id
  );

  const ignosId =
    post.authorIgnosId ??
    (post.author_id === CURRENT_USER_ID && getCurrentUserIgnosId()) ??
    (post.author_id ? String(post.author_id) : "guest");

  const tags = post.hashtags ?? [];
  const mainTag = tags[0];
  const hasMoreTags = tags.length > 1;

  const title =
    mainTag != null && mainTag !== ""
      ? `${mainTag}に関する問題`
      : post.question;

  const createdAt = createdAtOverride ?? post.createdAt;
  const createdAtText = formatDateYMD(createdAt);

  const handleProfileClick = () => {
    onOpenProfile?.(post.author_id ?? undefined);
  };

  const handleTagClick = () => {
    if (mainTag && onTagClick) onTagClick(mainTag);
  };

  return (
    <div className="py-1 border-b border-gray-200 last:border-b-0">
      {/* ▼ ヘッダー行：左＝ユーザー情報、右＝タグ＋… */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={handleProfileClick}
          className="flex items-center gap-2"
        >
          <div className="w-9 h-9 rounded-full bg-gray-300" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold">{displayName}</span>
            <span className="text-xs text-gray-500">@{ignosId}</span>
          </div>
        </button>

        {mainTag && (
          <div className="flex items-center justify-end gap-1 max-w-[50%] overflow-hidden whitespace-nowrap">
            <TagChip
              key={mainTag + String(post.id)}
              tag={mainTag}
              onClick={handleTagClick}
            />
            {hasMoreTags && (
              <span className="text-xs text-gray-500 align-middle">…</span>
            )}
          </div>
        )}
      </div>

      {/* ▼ 本文：タップで回答開始 */}
      <div
        className="text-[15px] whitespace-pre-wrap mb-2 cursor-pointer"
        onClick={onAnswer}
      >
        {title}
      </div>

      {/* ▼ 下部：ActionBar（Answer / Thanks / Look / Mark） */}
      <ActionBar
        likes={likes}
        retweets={retweets}
        answers={answers}
        onLike={onLike ?? (() => {})}
        onRT={onRT ?? (() => {})}
        onAnswer={onAnswer}
        isMarked={isMarked}
        onToggleMark={onToggleMark}
        isMine={isMine}
        onEdit={onEdit}
        createdAtText={createdAtText}
      />
    </div>
  );
};
