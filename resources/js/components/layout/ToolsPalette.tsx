// resources/js/components/layout/ToolsPalette.tsx
import React from "react";

type Props = {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  /** admin 用：JSON 一括投入を開きたいときに呼ばれる */
  onRequestBulkImport: () => void;
};

export const ToolsPalette: React.FC<Props> = ({
  open,
  isAdmin,
  onClose,
  onRequestBulkImport,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end pt-14 pr-3">
      {/* 背景をクリックすると閉じる */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* パレット本体 */}
      <div className="relative z-10 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3 text-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">ツール</span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="space-y-1">
          {/* ここに便利機能を追加していく */}
          <button className="w-full text-left px-2 py-1 rounded hover:bg-gray-100">
            今日の復習問題を出す（仮）
          </button>
          <button className="w-full text-left px-2 py-1 rounded hover:bg-gray-100">
            ランダム出題（仮）
          </button>

          {/* ★ admin 限定：JSON 一括投入 */}
          {isAdmin && (
            <button
              className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 text-red-600"
              onClick={() => {
                onRequestBulkImport();
                onClose();
              }}
            >
              問題一括登録（JSON）
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
