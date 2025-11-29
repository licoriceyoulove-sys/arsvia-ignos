// resources/js/components/ui/QuizPostCard.tsx
import React from "react";
import type { QuizPost, Visibility } from "../../types/quiz"; // ★ Visibility 追加
import { TagChip } from "../ui/TagChip";
import { ActionBar } from "../ui/ActionBar";
import {
  CURRENT_USER_ID,
  pickDisplayName,
  getCurrentUserIgnosId,
} from "../../utils/user";
import { VisibilityIcon } from "../ui/VisibilityIcon";

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

  isLiked?: boolean;
  isRetweeted?: boolean;

  // 編集 & プロフィール遷移
  isMine?: boolean;
  onEdit?: () => void;
  onOpenProfile?: (authorId?: number | string | null) => void;

  // タグをタップしたとき（フォルダクイズ開始など）
  onTagClick?: (tag: string) => void;

  // ★ 公開範囲アイコン用
  visibility?: Visibility | null;
  onClickVisibility?: () => void;
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
  isLiked,       
  isRetweeted,   
  isMine,
  onEdit,
  onOpenProfile,
  onTagClick,
  visibility,
  onClickVisibility,
}) => {
  const displayName = pickDisplayName(post.authorDisplayName, post.author_id);

  const ignosId =
    post.authorIgnosId ??
    (post.author_id === CURRENT_USER_ID && getCurrentUserIgnosId()) ??
    (post.author_id ? String(post.author_id) : "guest");

  const tags = post.hashtags ?? [];
  const mainTag = tags[0];
  const hasMoreTags = tags.length > 1;

  // ★ 単発投稿のタイトルは「問題文そのもの」に変更
  const title = post.question || "クイズ";

  const createdAt = createdAtOverride ?? post.createdAt;
  const createdAtText = formatDateYMD(createdAt);

  const handleProfileClick = () => {
    onOpenProfile?.(post.author_id ?? undefined);
  };

  const handleMainTagClick = () => {
    if (mainTag && onTagClick) onTagClick(mainTag);
  };

return (
  <div className="py-1 border-b border-gray-200 last:border-b-0">
{/* ▼ 上部ヘッダー行：左＝ユーザー情報、右＝タグ＋公開範囲アイコン */}
<div className="flex items-center justify-between gap-2 mb-2">
  {/* 左：ユーザー情報ボタン */}
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

  {/* 右：タグ + 公開範囲アイコン（同じ行・中心揃え） */}
  {(mainTag || visibility != null || post.visibility != null) && (
    <div className="flex items-center justify-end gap-1 max-w-[55%]">
      {/* タグ部分：高さ固定＋中央揃え */}
      {mainTag && (
        <div className="flex items-center h-7 overflow-hidden whitespace-nowrap">
          <TagChip
            key={mainTag + String(post.id)}
            tag={mainTag}
            onClick={handleMainTagClick}
          />
          {hasMoreTags && (
            <span className="ml-1 text-xs text-gray-500 align-middle">
              …
            </span>
          )}
        </div>
      )}

      {/* 公開範囲ボタン：タグと高さを揃え、右の余白を詰める */}
      {(visibility ?? post.visibility) != null && (
        <button
          type="button"
          className="
            flex-shrink-0 flex items-center justify-center
            h-7 w-7
            -ml-1               
          "
          onClick={(e) => {
            e.stopPropagation();
            onClickVisibility?.();
          }}
        >
          <VisibilityIcon value={visibility ?? post.visibility} />
        </button>
      )}
    </div>
  )}
</div>



    {/* ▼ 本文・ActionBar はそのまま */}
    <div
      className="text-[15px] whitespace-pre-wrap mb-2 cursor-pointer"
      onClick={onAnswer}
    >
      {title}
    </div>

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

      isLiked={isLiked}
      isRetweeted={isRetweeted}

    />
  </div>
);

}
