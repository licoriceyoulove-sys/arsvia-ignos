// resources/js/components/layout/BottomNav.tsx
import React from "react";

// ※ QuizApp.tsx 側にも同じ関数がありますが、今回は分かりやすさ優先でここにも定義します
const iconUrl = (name: string) => `./build/icons/${name}.png`;

type Props = {
  active: string;
  onHome: () => void;
  onSearch: () => void;
  onFolders: () => void;
  onDiscussions: () => void;
  onNotify: () => void;
  onProfile: () => void;
};

export const BottomNav: React.FC<Props> = ({
  active,
  onHome,
  onSearch,
  onFolders,
  onDiscussions,
  onNotify,
  onProfile,
}) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
    {/* <div className="max-w-md mx-auto grid grid-cols-5 text-xs"> */}
      <div className="max-w-md mx-auto flex text-xs">
      <button
        onClick={onHome}
        className={`flex-1 py-3 flex flex-col items-center ${
          active === "home" ? "text-black" : "text-gray-500"
        }`}
        aria-label="ホーム"
      >
        <img
          src={iconUrl("home")}
          alt="ホーム"
          className={`w-6 h-6 mb-1 ${
            active === "home" ? "opacity-100" : "opacity-60"
          }`}
        />
      </button>

      <button
        onClick={onSearch}
        className={`flex-1 py-3 flex flex-col items-center ${
          active === "search" ? "text-black" : "text-gray-500"
        }`}
        aria-label="検索"
      >
        <img
          src={iconUrl("search")}
          alt="検索"
          className={`w-6 h-6 mb-1 ${
            active === "search" ? "opacity-100" : "opacity-60"
          }`}
        />
      </button>

      <button
        onClick={onFolders}
        className={`flex-1 py-3 flex flex-col items-center ${
          active === "folders" ? "text-black" : "text-gray-500"
        }`}
        aria-label="クイズ"
      >
        <img
          src={iconUrl("quiz")}
          alt="クイズ"
          className={`w-6 h-6 mb-1 ${
            active === "folders" ? "opacity-100" : "opacity-60"
          }`}
        />
      </button>

<button
  onClick={onDiscussions}
  className={`flex-1 py-3 flex flex-col items-center ${
    active === "discussions" ? "text-black" : "text-gray-500"
  }`}
  aria-label="議論"
>
  <img
    src={iconUrl("discussion")} // ★ カスタムアイコンを置く想定
    alt="議論"
    className={`w-6 h-6 mb-1 ${
      active === "discussions" ? "opacity-100" : "opacity-60"
    }`}
  />
</button>


      <button
        onClick={onNotify}
        className={`flex-1 py-3 flex flex-col items-center ${
          active === "notifications" ? "text-black" : "text-gray-500"
        }`}
        aria-label="通知"
      >
        <img
          src={iconUrl("bell")}
          alt="通知"
          className={`w-6 h-6 mb-1 ${
            active === "notifications" ? "opacity-100" : "opacity-60"
          }`}
        />
      </button>

      {/* プロフィールアイコン */}
      <button
        onClick={onProfile}
        className={`flex-1 py-3 flex flex-col items-center ${
          active === "profile" ? "text-black" : "text-gray-500"
        }`}
        aria-label="プロフィール"
      >
        <img
          src={iconUrl("user")}
          alt="プロフィール"
          className={`w-6 h-6 mb-1 ${
            active === "profile" ? "opacity-100" : "opacity-60"
          }`}
        />
      </button>
    </div>
  </nav>
);
