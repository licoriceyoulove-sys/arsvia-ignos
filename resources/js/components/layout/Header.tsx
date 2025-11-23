// resources/js/components/layout/Header.tsx
import React from "react";

type HeaderProps = {
  onOpenSidebar: () => void;
  onOpenTools: () => void;
};

const Header: React.FC<HeaderProps> = ({ onOpenSidebar, onOpenTools }) => {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="h-12 flex items-center px-3">
        {/* 左：ハンバーガーメニュー */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="メニューを開く"
        >
          <span className="inline-block">
            <span className="block w-4 h-[2px] bg-gray-800 rounded mb-[3px]" />
            <span className="block w-4 h-[2px] bg-gray-800 rounded mb-[3px]" />
            <span className="block w-4 h-[2px] bg-gray-800 rounded" />
          </span>
        </button>

        {/* 中央：ロゴアイコン */}
        <div className="flex-1 flex justify-center pointer-events-none">
          {/* 画像ロゴがある場合はこれに差し替え */}
          <img src="./build/icons/icon-192.png" alt="Ignos" className="h-10 w-10" />
        </div>

        {/* 右：ツールボタン */}
        <button
          type="button"
          onClick={onOpenTools}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="ツールを開く"
        >
          {/* 簡易アイコン（Sparkles 的な） */}
          <span className="text-lg leading-none">✦</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
