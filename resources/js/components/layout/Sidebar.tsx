// resources/js/components/layout/Sidebar.tsx
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectHome: () => void;
  onSelectSearch: () => void;
  onSelectFolders: () => void;
  /** マイプロフィール項目を出したい場合だけ渡す */
  onSelectProfile?: () => void;
};

export const Sidebar: React.FC<Props> = ({
  open,
  onClose,
  onSelectHome,
  onSelectSearch,
  onSelectFolders,
  onSelectProfile,
}) => {
  if (!open) return null;

  const handleSelect =
    (cb: () => void) =>
    () => {
      cb();
      onClose();
    };

  return (
    <div className="fixed inset-0 z-30 flex">
      {/* 左のサイドバー本体 */}
      <div className="w-72 max-w-[80%] h-full bg-white shadow-xl border-r border-gray-200 flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-semibold">メニュー</span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
            onClick={handleSelect(onSelectHome)}
          >
            ホーム
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
            onClick={handleSelect(onSelectSearch)}
          >
            検索
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
            onClick={handleSelect(onSelectFolders)}
          >
            タグから探す
          </button>
          {onSelectProfile && (
            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
              onClick={handleSelect(onSelectProfile)}
            >
              マイプロフィール
            </button>
          )}
        </nav>
      </div>

      {/* 右側の半透明オーバーレイ：クリックで閉じる */}
      <button
        className="flex-1 h-full bg-black/30"
        onClick={onClose}
        aria-label="メニューを閉じる"
      />
    </div>
  );
};
