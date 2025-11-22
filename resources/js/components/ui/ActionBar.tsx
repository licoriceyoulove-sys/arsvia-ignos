// resources/js/components/ui/ActionBar.tsx
import React, { useState } from "react";

type ActionBarProps = {
  likes: number;
  retweets: number;
  answers?: number;
  onLike: () => void;
  onRT: () => void;
  onAnswer?: () => void;

  // ★ 追加
  isMine?: boolean;
  onEdit?: () => void;
};

export const ActionBar: React.FC<ActionBarProps> = ({
  likes,
  retweets,
  answers,
  onLike,
  onRT,
  onAnswer,
  isMine,
  onEdit,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between pt-2 text-sm text-gray-600">
      {/* 左側：RT / Like / Answer */}
      <div className="flex items-center gap-6">
        <button onClick={onRT} className="flex items-center gap-1">
          🔁 <span>{retweets}</span>
        </button>
        <button onClick={onLike} className="flex items-center gap-1">
          ⭐ <span>{likes}</span>
        </button>
        {onAnswer && (
          <button onClick={onAnswer} className="flex items-center gap-1">
            🅰 <span>{typeof answers === "number" ? answers : ""}</span>
          </button>
        )}
      </div>

      {/* 右側：三点リーダーメニュー */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded-full hover:bg-gray-100"
        >
          {/* ︙（三点） */}
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full"></span>
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full mx-[2px]"></span>
          <span className="inline-block w-1 h-1 bg-gray-600 rounded-full"></span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-lg z-20 text-sm">
            {isMine ? (
              <>
                {/* 自分の投稿 → 編集可能 */}
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
                {/* 他人の投稿 → ミュート/ブロック（まだ中身は無し） */}
                <button disabled className="w-full text-left px-4 py-2 text-gray-400">
                  この投稿をミュート（後で）
                </button>
                <button disabled className="w-full text-left px-4 py-2 text-gray-400">
                  このユーザーをミュート（後で）
                </button>
                <button disabled className="w-full text-left px-4 py-2 text-gray-400">
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
