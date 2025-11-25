// resources/js/components/ui/ActionBar.tsx
import React, { useState } from "react";

type ActionBarProps = {
  likes: number;
  retweets: number;
  answers?: number;
  onLike: () => void;
  onRT: () => void;
  onAnswer?: () => void;

  isMarked?: boolean;
  onToggleMark?: () => void;

  // ★ 追加
  isMine?: boolean;
  onEdit?: () => void;
  createdAtText?: string;
};

export const ActionBar: React.FC<ActionBarProps> = ({
  likes,
  retweets,
  answers,
  onLike,
  onRT,
  onAnswer,
  isMarked = false,
  onToggleMark,
  isMine,
  onEdit,
  createdAtText,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

return (
    <div className="flex items-center justify-between pt-2 text-[10px] text-gray-600">
      {/* 左側：Answer → Thanks → Look → Mark */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Answer */}
        {onAnswer && (
          <button onClick={onAnswer} className="flex items-center gap-1 font-handwriting border border-gray-400 px-1 py-1 rounded-lg">
            Answer
            <span>{typeof answers === "number" ? answers : ""}</span>
          </button>
        )}

        {/* Thanks（いいね） */}
        <button onClick={onLike} className="flex items-center gap-1 font-handwriting border border-gray-400 px-1 py-1 rounded-lg">
          Thanks
          <span>{likes}</span>
        </button>

        {/* Look（リツイート） */}
        <button onClick={onRT} className="flex items-center gap-1 font-handwriting border border-gray-400 px-1 py-1 rounded-lg">
          Look
          <span>{retweets}</span>
        </button>

        {/* Mark（ブックマーク ON/OFF） */}
        {onToggleMark && (
          <button
            onClick={onToggleMark}
            className="flex items-center gap-1 font-handwriting border border-gray-400 px-1 py-1 rounded-lg"
            aria-label="ブックマーク"
          >
            <span className={isMarked ? "text-black" : "text-gray-400"}>
              Mark
            </span>
          </button>
        )}
      </div>

      {/* 右側：日付 + 三点リーダーメニュー */}
      <div className="relative flex items-center gap-3">
        {/* 投稿日時（例: 2025/12/25） */}
        {createdAtText && (
          <span className="text-xs text-gray-400">{createdAtText}</span>
        )}

        {/* 三点リーダーボタン */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded-full hover:bg-gray-100"
        >
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full" />
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full mx-[2px]" />
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-lg z-20 text-sm">
            {isMine ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onEdit?.();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  編集
                </button>
                <button
                  disabled
                  className="w-full text-left px-4 py-2 text-gray-400"
                >
                  削除（後で実装）
                </button>
              </>
            ) : (
              <>
                <button
                  disabled
                  className="w-full text-left px-4 py-2 text-gray-400"
                >
                  この投稿をミュート（後で）
                </button>
                <button
                  disabled
                  className="w-full text-left px-4 py-2 text-gray-400"
                >
                  このユーザーをミュート（後で）
                </button>
                <button
                  disabled
                  className="w-full text-left px-4 py-2 text-gray-400"
                >
                  ブロック（後で）
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
