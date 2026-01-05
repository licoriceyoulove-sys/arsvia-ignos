// resources/js/components/profile/ProfileScreen.tsx
import React, { useMemo, useState } from "react";
import type { QuizPost } from "../../types/quiz";
import {
  CURRENT_USER_ID,
  pickDisplayName,
  getCurrentUserIgnosId,
} from "../../utils/user";
import { QuizPostCard } from "../ui/QuizPostCard";

type ProfileTab = "posts" | "revenge" | "thanks" | "bookmarks";

export type ProfileScreenProps = {
  userId: number;
  posts: QuizPost[];
  isFollowing: boolean;
  followingCount: number;
  followerCount: number;
  onToggleFollow: () => void;
  onBack: () => void;

  // ★ 追加：プロフィールから AnswerRunner を開くため
  onStartAnswer: (posts: QuizPost[]) => void;

  // ★ 追加：クイズIDごとの Thanks / Look / Answers 集計値
  //   例: reactionStats["quiz_id_xyz"] = { likes: 3, retweets: 1, answers: 5 }
  reactionStats?: Record<
    string,
    {
      likes: number;
      retweets: number;
      answers: number;
    }
  >;
};

// 日付表示（必要なら使う用。現状このファイルでは未使用だが残しておいてOK）
const formatDateYMD = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userId,
  posts,
  isFollowing,
  followingCount,
  followerCount,
  onToggleFollow,
  onBack,
  onStartAnswer,
  reactionStats = {}, // ★ デフォルトは空オブジェクト
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [markedIds, setMarkedIds] = useState<string[]>([]);

  const toggleLocalMark = (id: string) => {
    setMarkedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isMe = userId === CURRENT_USER_ID;

  // このユーザーの投稿のみ
  const myPosts = useMemo(
    () => posts.filter((p) => p.author_id === userId),
    [posts, userId]
  );

  // 何か1件取れればそこから表示名・IGNOS_ID を使う
  const firstPost = myPosts[0];

  const displayName = pickDisplayName(
    posts.find((p) => p.author_id === userId)?.authorDisplayName,
    userId
  );

  const ignosId =
    firstPost?.authorIgnosId ??
    (isMe && getCurrentUserIgnosId()
      ? getCurrentUserIgnosId()!
      : userId
      ? String(userId)
      : "guest");

  const postCount = myPosts.length;

  const renderTabButton = (tab: ProfileTab, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex-1 pb-2 text-sm font-medium border-b-2 ${
        activeTab === tab
          ? "border-black text-black"
          : "border-transparent text-gray-500"
      }`}
    >
      {label}
    </button>
  );

  let body: React.ReactNode;

  if (activeTab === "posts") {
    body = (
      <div>
        {myPosts.length === 0 && (
          <div className="px-4 py-6 text-sm divide-gray-200">
            まだ投稿がありません。クイズを投稿してみましょう。
          </div>
        )}

        {myPosts.map((p) => {
          // ★ このクイズIDに対応する Thanks / Look / Answer を取得
          const stats = reactionStats[p.id] ?? {
            likes: 0,
            retweets: 0,
            answers: 0,
          };

          return (
            <div key={p.id} className="px-4">
              <QuizPostCard
                post={p}
                likes={stats.likes}
                retweets={stats.retweets}
                answers={stats.answers}
                isMarked={markedIds.includes(p.id)}
                onAnswer={() => onStartAnswer([p])}
                onToggleMark={() => toggleLocalMark(p.id)}
                // プロフィール画面なので Like/RT アクションはナシ（表示専用）
                onLike={undefined}
                onRT={undefined}
                isMine={userId === CURRENT_USER_ID}
                onOpenProfile={() => {}}
                onTagClick={() => {}}
              />
            </div>
          );
        })}
      </div>
    );
  } else if (activeTab === "revenge") {
    body = (
      <div className="px-4 py-6 text-sm divide-gray-200">
        リベンジリストはまだありません。（実装予定）
      </div>
    );
  } else if (activeTab === "thanks") {
    body = (
      <div className="px-4 py-6 text-sm divide-gray-200">
        Thanks リストはまだありません。（実装予定）
      </div>
    );
  } else {
    body = (
      <div className="px-4 py-6 text-sm divide-gray-200">
        ブックマークした投稿はまだありません。（実装予定）
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* ヘッダー画像 */}
      <div className="w-full h-24 bg-gray-200" />

      {/* アイコン＋名前など */}
      <div className="px-4 -mt-10 flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-20 h-20 rounded-full bg-gray-300 border-4 border-white" />
          <div className="mt-6">
            <div className="font-bold text-lg">{displayName}</div>
            <div className="text-sm text-gray-500">@{ignosId}</div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          {isMe ? (
            <button className="px-3 py-2 rounded-full bg-black text-white text-sm font-bold">
              プロフィール編集
            </button>
          ) : (
            <button
              onClick={onToggleFollow}
              className={`px-3 py-2 rounded-full text-sm font-bold ${
                isFollowing
                  ? "bg-gray-100 text-gray-800 border"
                  : "bg-black text-white"
              }`}
            >
              {isFollowing ? "フォロー解除" : "フォローする"}
            </button>
          )}

          {/* 三点リーダーメニュー */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-3 py-2 rounded-full border text-sm"
              aria-label="メニュー"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded-xl shadow-lg text-sm z-10">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">
                  ブロック（予定）
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">
                  ミュート（予定）
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600">
                  報告（予定）
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* フォロー数など */}
      <div className="px-4 mt-4 mb-3 flex gap-4 text-sm">
        <div>
          <span className="font-bold mr-1">{followingCount}</span>
          <span className="text-gray-500">フォロー中</span>
        </div>
        <div>
          <span className="font-bold mr-1">{followerCount}</span>
          <span className="text-gray-500">フォロワー</span>
        </div>
        <div>
          <span className="font-bold mr-1">{postCount}</span>
          <span className="text-gray-500">投稿</span>
        </div>
      </div>

      {/* プロフィール本文（仮文言） */}
      <div className="px-4 mb-3 text-sm text-gray-700 whitespace-pre-wrap">
        まだプロフィール文は設定されていません。
      </div>

      {/* タブ */}
      <div className="px-4 border-b border-gray-200 flex gap-3">
        {renderTabButton("posts", "Posts")}
        {renderTabButton("revenge", "Revenge")}
        {renderTabButton("thanks", "Thanks")}
        {renderTabButton("bookmarks", "Mark")}
      </div>

      {/* タブの中身 */}
      {body}
    </div>
  );
};
