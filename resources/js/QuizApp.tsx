// ファイル構成図
// resources/js/
//   QuizApp.tsx                // 画面のルート。状態管理＆画面切り替えだけに寄せていく

//   api/
//     client.ts                // 既存
//     mapper.ts                // 既存

//   types/
//     quiz.ts                  // 型定義をここに集約（QuizPost / FeedItem / Visibility など）

//   components/
//     layout/
//       Header.tsx             // 画面上部ヘッダー
//       BottomNav.tsx          // 画面下部ナビ
//       Modal.tsx              // フルスクリーンモーダル

//     ui/
//       Card.tsx               // 共通カード
//       SectionTitle.tsx       // セクションタイトル
//       TagChip.tsx            // タグのチップ表示
//       ActionBar.tsx          // いいね／RT／回答ボタン

//     folders/
//       FolderList.tsx         // 「タグから探す」画面（フォルダ一覧）

//     quiz/
//       QuizRunner.tsx         // タグからランダム10問
//       AnswerRunner.tsx       // 1投稿（またはバンドル）に対するクイズ実行

//     composer/
//       Composer.tsx           // 投稿モーダル全体
//       MultiEditor.tsx        // 複数問題エディタ（Composer の子）


import React, { useEffect, useMemo, useState } from "react";
// import { getQuizzes } from "./api/client";

import { fromQuizRow } from "./api/mapper";
// import { bulkUpsertQuizzes, postFeed, patchFeed, API_BASE } from "./api/client";
import {
  getQuizzes,
  getUserQuizzes,
  bulkUpsertQuizzes,
  postFeed,
  patchFeed,
  API_BASE,
  searchUsers,
  deleteQuizzes,   // ★追加
  getCategoryLarges,
  getCategoryMiddles,
  getCategorySmalls,
  getGlobalQuizzes,
  updateQuizVisibility,
} from "./api/client";

import type { UserSearchResult, CategoryLarge, CategoryMiddle, CategorySmall, } from "./api/client";
import { toQuizRow, toFeedRow } from "./api/mapper";
import axios from "axios";
import type {
  QuizType,
  Visibility,
  QuizPost,
  QuizSeed,
  SharePost,
  FeedItem,
  FeedQuizBundleItem,
} from "./types/quiz";
import Header from "./components/layout/Header";
import { BottomNav } from "./components/layout/BottomNav";
import { Modal } from "./components/layout/Modal";

import { Card } from "./components/ui/Card";
import { SectionTitle } from "./components/ui/SectionTitle";
import { TagChip } from "./components/ui/TagChip";
import { ActionBar } from "./components/ui/ActionBar";

import { CURRENT_USER_ID, pickDisplayName, getCurrentUserIgnosId } from "./utils/user";
import { IS_ADMIN } from "./utils/user";
console.log("DEBUG Current User ID =", CURRENT_USER_ID);
console.log("DEBUG accountLevel =", window.Ignos?.accountLevel);
console.log("DEBUG IS_ADMIN =", IS_ADMIN);

import { ProfileScreen } from "./components/profile/ProfileScreen";
import { QuizPostCard } from "./components/ui/QuizPostCard";

// 議論系
import DiscussionList from "./components/discussion/DiscussionList";
import DiscussionDetailView from "./components/discussion/DiscussionDetail";
import DiscussionComposer from "./components/discussion/DiscussionComposer";
import OpinionComposer from "./components/discussion/OpinionComposer";
import {
  fetchDiscussions,
  fetchDiscussionDetail,
  createDiscussion,
  createOpinion,
  voteOpinion,
} from "./api/discussion";
import type {
  DiscussionSummary,
  DiscussionDetail,
  DiscussionOpinion,
  OpinionVoteStats,
  VoteKind,
} from "./types/discussion";
import { VisibilityIcon } from "./components/ui/VisibilityIcon";
// ★ フォロー中ユーザーID一覧
  

/**
 * スマホ向け・X（旧Twitter）風UIの個人用クイズアプリ（完全版）
 * - 画面下部ナビ（ホーム／検索／クイズ／通知／投稿）
 * - 投稿はモーダル（投稿 or キャンセルで閉じる）
 * - クイズ（フォルダ一覧）から開始／共有（ホームに共有投稿を追加）
 * - タイムラインに いいね／リツイート風ボタン
 * - ランダム10問、自動採点/自己申告、リザルト表示
 * - 選択肢問題は「投稿時に正解を明示」「出題時は選択肢を毎回シャッフル」
 * - カテゴリ別JSON（src/data/categories/*.json）を自動読み込み・初回のみ投入（重複防止）
 * - Tailwind v4 を想定（index.css に `@import "tailwindcss";`、postcss は `@tailwindcss/postcss`）
 */


const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// #タグ入力を配列化（#, 空白/カンマ/改行区切り）
const parseHashtags = (input: string): string[] =>
  (input ?? "")
    .split(/[\s,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));

// seeds -> QuizPost 変換
const seedsToPosts = (seeds: QuizSeed[]): QuizPost[] => {
  const now = Date.now();
  return seeds.map((s, i) => ({
    id: uid(),
    question: s.question,
    type: s.type,
    choices: s.type === "choice" ? s.choices : undefined,
    correctIndex: s.type === "choice" ? s.correctIndex : undefined,
    modelAnswer: s.type === "text" ? s.modelAnswer : s.modelAnswer || undefined,
    note: s.note || undefined,
    hashtags: s.hashtags ?? [],
    createdAt: now + i,
    author_id: CURRENT_USER_ID,
    visibility: 1,
  }));
};

// 日付フォーマット用ユーティリティ
const formatDateYMD = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

// ★ 公開範囲アイコン
// visibility: 1 = 自分のみ, 2 = フォロワー限定, 3 = グローバル
const renderVisibilityIcon = (v?: Visibility | null) => {
  if (v === 1) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 text-[10px]"
        title="自分のみ"
      >
        🔒
      </span>
    );
  }
  if (v === 2) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 text-[10px]"
        title="フォロワー限定"
      >
        👥
      </span>
    );
  }
  if (v === 3) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 text-[10px]"
        title="グローバル"
      >
        🌐
      </span>
    );
  }
  return null;
};

/* =========================
   カテゴリJSON自動読み込み
========================= */
// Vite: src/data/categories/*.json を一括 import
type JsonModule = { default: QuizSeed[] };
const CATEGORY_GLOB = import.meta.glob<JsonModule>("./data/categories/*.json", {
  eager: true,
});

// パス -> カテゴリキー（拡張子除去）
const fileKeyToCategory = (path: string) => {
  const name = path.split("/").pop() || "category";
  return name.replace(/\.json$/i, "");
};

/* =========================
   UI パーツ
========================= */

// const iconUrl = (name: string) =>
//   `${import.meta.env.BASE_URL}icons/${name}.png`;
const iconUrl = (name: string) => `./build/icons/${name}.png`;

const Composer: React.FC<{
  onCancel: () => void;
  onPostBundle?: (posts: QuizPost[]) => void;   // 新規まとめ投稿
  onEditBundle?: (payload: { posts: QuizPost[]; deletedIds: string[] }) => void;
  mode?: "create" | "edit";
  initialPosts?: QuizPost[] | null;             // 編集対象（0 or 複数）
}> = ({
  onCancel,
  onPostBundle,
  onEditBundle,
  mode = "create",
  initialPosts,
}) => {



// 共通タグ
const [sharedTags, setSharedTags] = useState<string>(() => {
  if (initialPosts && initialPosts.length > 0) {
    return (initialPosts[0].hashtags ?? []).join(" ");
  }
  return "";
});
  const [activeIdx, setActiveIdx] = useState<number>(0); // 表示中の問題インデックス
// 公開範囲
const [visibility, setVisibility] = useState<Visibility>(
  initialPosts?.[0]?.visibility ?? 1
);
  // 複数問題 用 state（最大10）
  
// ドラフト型（id を持つようにしておくと楽）
type Draft = {
  id?: string;
  type: QuizType;
  question: string;
  note: string;
  tagsInput: string;
  correctChoice: string;
  wrongChoices: string[];
  modelAnswer: string;
};
const makeEmptyDraft = (): Draft => ({
  id: undefined,
  type: "choice",
  question: "",
  note: "",
  tagsInput: "",
  correctChoice: "",
  wrongChoices: ["", ""],
  modelAnswer: "",
});
const [drafts, setDrafts] = useState<Draft[]>(() => {
  if (!initialPosts || initialPosts.length === 0) {
    // 新規投稿モード
    return [makeEmptyDraft()];
  }

  // 編集モード：initialPosts の1件1件を Draft に変換
  return initialPosts.map((p) => {
    if (p.type === "choice") {
      const choices = p.choices ?? [];
      const correctIndex = p.correctIndex ?? 0;
      const correct = choices[correctIndex] ?? "";
      const wrong = choices.filter((_, i) => i !== correctIndex);

      return {
        id: p.id,
        type: "choice",
        question: p.question,
        note: p.note ?? "",
        tagsInput: "",
        correctChoice: correct,
        wrongChoices: wrong.length ? wrong : ["", ""],
        modelAnswer: "",
      };
    } else {
      return {
        id: p.id,
        type: "text",
        question: p.question,
        note: p.note ?? "",
        tagsInput: "",
        correctChoice: "",
        wrongChoices: ["", ""],
        modelAnswer: p.modelAnswer ?? "",
      };
    }
  });
});

  // 複数用の Post 化関数（共通タグを使う）
  const toQuizPostWithSharedTags = (
    d: Draft,
    tagsText: string,
    visibility: Visibility
  ): QuizPost | null => {
    if (!d.question.trim()) return null;
    const tags = parseHashtags(tagsText); // ← 共通タグ
    if (tags.length === 0) return null;

    if (d.type === "choice") {
      const correctOk = d.correctChoice.trim().length > 0;
      const wrongFilled = d.wrongChoices.map((s) => s.trim()).filter(Boolean);
      if (!correctOk || wrongFilled.length < 1) return null;
      return {
        id: uid(),
        question: d.question.trim(),
        type: "choice",
        choices: [d.correctChoice.trim(), ...wrongFilled],
        correctIndex: 0,
        note: d.note.trim() || undefined,
        hashtags: tags, // ← 共通タグをセット
        createdAt: Date.now(),
        author_id: CURRENT_USER_ID,
        visibility,
      };
    } else {
      if (!d.modelAnswer.trim()) return null;
      return {
        id: uid(),
        question: d.question.trim(),
        type: "text",
        modelAnswer: d.modelAnswer.trim(),
        note: d.note.trim() || undefined,
        hashtags: tags, // ← 共通タグをセット
        createdAt: Date.now(),
        author_id: CURRENT_USER_ID,
        visibility,
      };
    }
  };

  const canPostMulti = useMemo(() => {
    if (drafts.length === 0 || drafts.length > 10) return false;
    const tags = parseHashtags(sharedTags); // 共通タグ必須
    if (tags.length === 0) return false;

    const posts = drafts
      .map((d) => toQuizPostWithSharedTags(d, sharedTags, visibility))
      .filter(Boolean) as QuizPost[];
    return posts.length === drafts.length;
  }, [drafts, sharedTags, visibility]);

  // submitMulti も置き換え
const submitMulti = () => {
  const baseTime = initialPosts?.[0]?.createdAt ?? Date.now();
  const originalBundleId = initialPosts?.[0]?.bundleId;

  const bundleIdBase =
    originalBundleId ?? (mode === "create" ? uid() : undefined);

  const posts = drafts
    .map((d, idx) => {
      const p = toQuizPostWithSharedTags(d, sharedTags, visibility);
      if (!p) return null;

      // もともとあった id があればそれを優先（編集時）
      const id = d.id ?? initialPosts?.[idx]?.id ?? uid();

      return {
        ...p,
        id,
        bundleId: bundleIdBase,
        bundleOrder: idx,
        createdAt: initialPosts?.[idx]?.createdAt ?? baseTime + idx,
      } as QuizPost;
    })
    .filter(Boolean) as QuizPost[];

  if (!posts.length || posts.length > 10) return;

  // ★ 元のIDたち
  const originalIds = (initialPosts ?? []).map((p) => p.id);
  // ★ 更新後のIDたち
  const updatedIds = posts.map((p) => p.id);
  // ★ 元にあったけど今ない → 削除されたID
  const deletedIds = originalIds.filter((id) => !updatedIds.includes(id));

  if (mode === "edit" && onEditBundle) {
    onEditBundle({ posts, deletedIds });
    onCancel();
    return;
  }

  if (onPostBundle) {
    onPostBundle(posts);
    onCancel();
  }
};




  // UI
    // UI
  return (
    // モーダル全体を上下レイアウトにする
    <div className="flex flex-col h-full">
      {/* 上部ヘッダー（固定表示） */}
      <div className="flex items-center justify-between px-4 h-12 border-b flex-none">
        <button
          onClick={onCancel}
          className="text-sm text-gray-600"
        >
          キャンセル
        </button>

        {/* 真ん中のタイトル：モードで出し分け */}
        <div className="text-sm font-bold">
          {mode === "edit" ? "投稿を編集" : ""}
        </div>

        <button
          disabled={!canPostMulti} // ★ ここはそのまま使ってOK（編集時も1件だけなので true/false 判定に使える）
          onClick={submitMulti}
          className={`px-4 py-1 rounded-full text-sm font-bold ${
            canPostMulti ? "bg-black text-white" : "bg-gray-200 text-gray-400"
          }`}
        >
          {/* ★ モードでラベルを出し分け */}
          {mode === "edit" ? "保存" : `投稿（${drafts.length}問）`}
        </button>
      </div>

      {/* 下：スクロール可能な投稿フォーム本体 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 共通タグ入力（全問題に適用） */}
        <div className="mb-2">
          <div className="text-xs font-bold mb-1">タグ設定</div>
          <input
            value={sharedTags}
            onChange={(e) => setSharedTags(e.target.value)}
            placeholder="#英単語 #歴史 など（カンマ・空白区切り）"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
          />
        </div>

        {/* 公開範囲の選択 */}
        <div className="mb-2">
          <div className="text-xs font-bold mb-1">公開範囲</div>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setVisibility(1)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 1
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              プライベート
            </button>
            <button
              type="button"
              onClick={() => setVisibility(2)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 2
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              フォロワー限定
            </button>
            <button
              type="button"
              onClick={() => setVisibility(3)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 3
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              グローバル
            </button>
          </div>
        </div>

{/* ナビゲーション */}
{drafts.length > 1 ? (
  <div className="flex items-center justify-between">
    <button
      onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
      className="px-3 py-1 rounded-full border"
      disabled={activeIdx === 0}
      aria-label="前の問題"
    >
      ＜
    </button>
    <div className="text-sm">
      問題 {activeIdx + 1} / {drafts.length}
    </div>
    <button
      onClick={() =>
        setActiveIdx((i) => Math.min(drafts.length - 1, i + 1))
      }
      className="px-3 py-1 rounded-full border"
      disabled={activeIdx === drafts.length - 1}
      aria-label="次の問題"
    >
      ＞
    </button>
  </div>
) : (
  <div className="text-sm font-bold">
    {mode === "edit" ? "この投稿を編集" : ""}
  </div>
)}


        {/* 表示中の1問だけ編集 */}
        <MultiEditor
          index={activeIdx + 1}
          draft={drafts[activeIdx]}
          onChange={(nd) =>
            setDrafts((prev) => prev.map((x, i) => (i === activeIdx ? nd : x)))
          }
          onRemove={() => {
            setDrafts((prev) => {
              const next = prev.filter((_, i) => i !== activeIdx);
              const nextIdx = Math.max(0, Math.min(activeIdx, next.length - 1));
              setActiveIdx(nextIdx);
              return next.length ? next : [makeEmptyDraft()];
            });
          }}
          removable={drafts.length > 1}

        />

        {/* 追加ボタン（追加後は新規問題がアクティブに） */}
        {drafts.length < 10 && (
          <div>
            <button
              onClick={() =>
                setDrafts((prev) => {
                  const next = [...prev, makeEmptyDraft()];
                  setActiveIdx(next.length - 1);
                  return next;
                })
              }
              className="text-blue-600 text-sm"
            >
              + 問題を追加
            </button>
          </div>
        )}

      </div>
    </div>
  );
};




// 複数問題エディタ
const MultiEditor: React.FC<{
  index: number;
  draft: any;
  onChange: (d: any) => void;
  onRemove: () => void;
  removable: boolean;
}> = ({ index, draft, onChange, onRemove, removable }) => {
  const set = (patch: Partial<typeof draft>) =>
    onChange({ ...draft, ...patch });
  const updateWrong = (i: number, val: string) =>
    set({
      wrongChoices: draft.wrongChoices.map((x: string, idx: number) =>
        idx === i ? val : x
      ),
    });
  const addWrong = () => set({ wrongChoices: [...draft.wrongChoices, ""] });
  const removeWrong = (i: number) =>
    set({
      wrongChoices: draft.wrongChoices.filter(
        (_: string, idx: number) => idx !== i
      ),
    });

  return (
    <div className="p-3 rounded-2xl border">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold">問題 {index}</div>
        {removable && (
          <button onClick={onRemove} className="text-xs text-gray-500">
            削除
          </button>
        )}
      </div>

      <textarea
        value={draft.question}
        onChange={(e) => set({ question: e.target.value })}
        className="w-full resize-none outline-none placeholder:text-gray-400 text-[16px] min-h-[64px]"
        placeholder="問題文"
      />

      <div className="flex gap-2 text-sm mb-3 mt-2">
        <button
          className={`px-2 py-1 rounded-full border ${
            draft.type === "choice"
              ? "bg-black text-white border-black"
              : "border-gray-300"
          }`}
          onClick={() => set({ type: "choice" })}
        >
          選択肢
        </button>
        <button
          className={`px-2 py-1 rounded-full border ${
            draft.type === "text"
              ? "bg-black text-white border-black"
              : "border-gray-300"
          }`}
          onClick={() => set({ type: "text" })}
        >
          テキスト入力
        </button>
      </div>

      {draft.type === "choice" ? (
        <div className="mb-3 space-y-3">
          <div>
            <div className="text-xs font-bold text-green-700 mb-1">正解</div>
            <input
              value={draft.correctChoice}
              onChange={(e) => set({ correctChoice: e.target.value })}
              placeholder="正解の選択肢"
              className="w-full px-3 py-2 bg-green-50 rounded-xl border border-green-200"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-700 mb-1">
              不正解（複数可）
            </div>
            {draft.wrongChoices.map((c: string, i: number) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  value={c}
                  onChange={(e) => updateWrong(i, e.target.value)}
                  placeholder={`不正解 ${i + 1}`}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
                />
                {draft.wrongChoices.length > 1 && (
                  <button
                    onClick={() => removeWrong(i)}
                    className="text-gray-500 text-sm"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
            <button onClick={addWrong} className="text-blue-600 text-sm">
              + 不正解を追加
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <input
            value={draft.modelAnswer}
            onChange={(e) => set({ modelAnswer: e.target.value })}
            placeholder="模範解答（採点の目安）"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
          />
        </div>
      )}

      <div className="mb-2">
        <input
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="補足（任意）"
          className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
        />
      </div>
    </div>
  );
};

// JSON 一括投入用の入力フォーマット
type BulkInputItem = {
  question: string;
  type?: "choice" | "text";        // 省略時は "choice"
  choices?: string[];              // choice のとき。省略時は自動組み立て
  correct?: string;                // 正解（必須）
  wrongs?: string[];               // 不正解の配列（1つ以上推奨）
  modelAnswer?: string;            // テキスト問題用の模範解答
  note?: string;                   // 解説・補足
};

const BulkImportDialog: React.FC<{
  onClose: () => void;
  onImported: (posts: QuizPost[]) => void;
}> = ({ onClose, onImported }) => {
  const [tagsInput, setTagsInput] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(3); // デフォルト: グローバル
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuizPost[] | null>(null);

  const handlePreview = () => {
    setError(null);
    setPreview(null);

    const tags = parseHashtags(tagsInput);
    if (tags.length === 0) {
      setError("タグを1つ以上入力してください。");
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (e) {
      setError("JSON の形式が不正です。配列形式で貼り付けてください。");
      return;
    }

    if (!Array.isArray(raw)) {
      setError("JSON の最上位は配列である必要があります。");
      return;
    }

    if (raw.length === 0) {
      setError("問題が1件も含まれていません。");
      return;
    }

    if (raw.length > 50) {
      setError(`問題は最大 50 件までです（現在 ${raw.length} 件）。`);
      return;
    }

    const now = Date.now();
    const posts: QuizPost[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i] as BulkInputItem;
      const idxLabel = `#${i + 1}番目の問題`;

      if (!item.question || !item.correct) {
        setError(`${idxLabel} に question または correct がありません。`);
        return;
      }

      const type: QuizType = item.type ?? "choice";

      if (type === "choice") {
        const wrongs = (item.wrongs ?? []).map((w) => String(w).trim()).filter(Boolean);
        const correct = String(item.correct).trim();
        if (!correct) {
          setError(`${idxLabel} の correct が空です。`);
          return;
        }
        if (wrongs.length < 1) {
          setError(`${idxLabel} の wrongs は 1 件以上必要です。`);
          return;
        }
        const choices = [correct, ...wrongs];

        posts.push({
          id: uid(),
          question: String(item.question).trim(),
          type: "choice",
          choices,
          correctIndex: 0,
          note: item.note?.toString().trim() || undefined,
          hashtags: tags,
          createdAt: now + i,
          author_id: CURRENT_USER_ID,
          visibility,
        });
      } else {
        const modelAnswer = item.modelAnswer ?? item.correct;
        if (!modelAnswer) {
          setError(`${idxLabel} の modelAnswer / correct がありません（テキスト問題）。`);
          return;
        }
        posts.push({
          id: uid(),
          question: String(item.question).trim(),
          type: "text",
          modelAnswer: String(modelAnswer).trim(),
          note: item.note?.toString().trim() || undefined,
          hashtags: tags,
          createdAt: now + i,
          author_id: CURRENT_USER_ID,
          visibility,
        });
      }
    }

    setPreview(posts);
  };

  const handleImport = () => {
    if (!preview || preview.length === 0) return;
    onImported(preview);
    onClose();
  };

  return (
    
    <div className="flex flex-col h-full max-h-[90vh]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold">問題一括登録（JSON）</div>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
        >
          閉じる
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 text-sm">
        {/* AI向けプロンプト（コピー用） */}
<div>
  <div className="text-xs font-bold mb-1">
    AI向けプロンプト（コピーして使えます）
  </div>

  <textarea
    readOnly
    value={`あなたは教育用クイズ問題を作成するエキスパートです。
以下の条件に従い、クイズ問題を JSON 配列形式で作成してください。

【出力形式について】
- JSON 配列（[]）のみを出力
- 各要素が 1 問に対応
- 配列の最上位以外は一切出力しない（説明文・補足禁止）
- コメントや余計な文字は禁止
- 50問以内で作成すること

【1問の形式】
{
  "question": "問題文",
  "type": "choice" または "text",
  "correct": "正解",
  "wrongs": ["不正解1", "不正解3"],
  "note": "各選択肢に関する補足・根拠を読んだだけで理解深まる品質で、必要に応じて例文を交えながら丁寧語で解説してください"
}

【生成してほしい内容】
（ここに分野を書く）

【最終出力】
JSON 配列のみを出力`}
    className="w-full h-40 p-3 border rounded-xl bg-gray-50 text-xs font-mono"
  />
</div>

        <div>
          <div className="text-xs font-bold mb-1">タグ（全問題共通）</div>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#英単語 #歴史 など（空白・カンマ区切り）"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
          />
        </div>

        <div>
          <div className="text-xs font-bold mb-1">公開範囲（全問題共通）</div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setVisibility(1)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 1
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              プライベート
            </button>
            <button
              type="button"
              onClick={() => setVisibility(2)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 2
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              フォロワー限定
            </button>
            <button
              type="button"
              onClick={() => setVisibility(3)}
              className={`px-3 py-1 rounded-full border ${
                visibility === 3
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              グローバル
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold mb-1">問題データ（JSON）</div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={`[
  {
    "question": "apple の意味は？",
    "type": "choice",
    "correct": "りんご",
    "wrongs": ["みかん", "ぶどう", "バナナ"],
    "note": "apple は果物のりんご。"
  },
  {
    "question": "日本の首都は？",
    "type": "text",
    "correct": "東京",
    "note": "東京都。"
  }
]`}
            className="w-full h-48 p-3 border rounded-xl bg-gray-50 border-gray-200 font-mono text-xs"
          />
        </div>

        {error && (
          <div className="text-xs text-red-600 whitespace-pre-wrap">{error}</div>
        )}

        {preview && (
          <div className="text-xs text-gray-600">
            プレビュー件数: {preview.length} 件
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-3">
        <button
          onClick={handlePreview}
          className="px-4 py-2 rounded-full bg-gray-100 text-sm"
        >
          プレビュー
        </button>
        <button
          onClick={handleImport}
          disabled={!preview || preview.length === 0}
          className={`px-4 py-2 rounded-full text-sm font-bold ${
            preview && preview.length > 0
              ? "bg-black text-white"
              : "bg-gray-200 text-gray-400"
          }`}
        >
          この内容で登録
        </button>
      </div>
    </div>
  );
};


/* =========================
   フォルダ（タグ）一覧
========================= */
// カテゴリツリー用の型
type CategorySmallNode = {
  id: number;
  name: string;     // 小カテゴリ名
  tags: string[];   // この小カテゴリに紐づくタグ一覧
};

type CategoryMiddleNode = {
  id: number;
  name: string;           // 中カテゴリ名
  smalls: CategorySmallNode[];
};

type CategoryLargeNode = {
  id: number;
  name: string;           // 大カテゴリ名
  middles: CategoryMiddleNode[];
};

const FolderList: React.FC<{
  posts: QuizPost[];
  onStartQuiz: (tag: string) => void;
  onShare: (tag: string) => void;
  categoryLarges: CategoryLarge[];
  categoryMiddles: CategoryMiddle[];
  categorySmalls: CategorySmall[];
}> = ({ posts, onStartQuiz, onShare, categoryLarges = [], categoryMiddles, categorySmalls, }) => {
    // 小カテゴリごとの tag 集計: key = category_tag
  const tagCountByCategoryTag = useMemo(() => {
    const result = new Map<string, [string, number][]>();

    // category_tag ごとに投稿をまとめる
    const postsByCat = new Map<string, QuizPost[]>();
    posts.forEach((p) => {
      const cat = p.category_tag ?? "";
      if (!cat) return;
      const list = postsByCat.get(cat) ?? [];
      list.push(p);
      postsByCat.set(cat, list);
    });

    // 各 category_tag ごとにタグ集計
    postsByCat.forEach((plist, cat) => {
      const map = new Map<string, number>();
      plist.forEach((p) => {
        (p.hashtags ?? []).forEach((t) =>
          map.set(t, (map.get(t) ?? 0) + 1)
        );
      });
      const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      result.set(cat, arr);
    });

    return result;
  }, [posts]);

  
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");

  // 大 / 中 / 小 カテゴリの開閉状態
  const [openLargeId, setOpenLargeId] = useState<number | null>(null);
  const [openMiddleId, setOpenMiddleId] = useState<number | null>(null);
  const [openSmallId, setOpenSmallId] = useState<number | null>(null);

const tagCount = useMemo(() => {
  // tag -> { count: 出現回数, latest: そのタグを持つ投稿の中で最新の createdAt }
  const map = new Map<string, { count: number; latest: number }>();

  posts.forEach((p) => {
    // createdAt が number 前提ですが、もし string の場合にも一応対応
    const ts =
      typeof p.createdAt === "number"
        ? p.createdAt
        : new Date(p.createdAt as any).getTime();

    (p.hashtags ?? []).forEach((t) => {
      const info = map.get(t);
      if (!info) {
        map.set(t, { count: 1, latest: ts });
      } else {
        info.count += 1;
        if (ts > info.latest) info.latest = ts;
      }
    });
  });

  // 「新しく追加されたタグ順」にソート（latest の降順）
  const sorted = Array.from(map.entries()).sort(
    (a, b) => b[1].latest - a[1].latest
  );

  // 上位20件だけ使う。返り値は [tag, count] の形のままにしておく
  return sorted
    .slice(0, 20)
    .map(([tag, info]) => [tag, info.count] as [string, number]);
}, [posts]);


  // 検索キーワードでタグを絞り込み
  const filteredTagCount = useMemo(() => {
    if (!keyword.trim()) return tagCount;
    const kw = keyword.trim();
    return tagCount.filter(([tag]) => tag.includes(kw));
  }, [tagCount, keyword]);

  const handleSearchClick = () => {
    setKeyword(keywordInput.trim());
  };

  return (
    <Card>
      <SectionTitle title="タグから探す" />
      <div className="px-4 pb-4 space-y-4">
        {/* ▼ 検索フォーム（ユーザー検索と同じようなイメージ） */}
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="タグを検索"
            className="flex-1 px-3 py-2 border rounded-xl text-sm bg-gray-50 border-gray-200"
          />
          <button
            type="button"
            onClick={handleSearchClick}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold"
          >
            検索
          </button>
        </div>

        {/* ▼ 検索結果（＝タグ一覧） */}
        <div className="space-y-2">
          {filteredTagCount.length === 0 && (
            <div className="text-gray-500 text-sm">
              該当するタグがありません
            </div>
          )}
          {filteredTagCount.map(([tag, count]) => (
            <div key={tag} className="flex items-center gap-2">
              <TagChip
                tag={`${tag}（${count}）`}
                onClick={() => onStartQuiz(tag)}
              />
              <button
                onClick={() => onStartQuiz(tag)}
                className="px-3 py-1 rounded-full text-sm bg-black text-white"
              >
                Answer
              </button>
              <button
                onClick={() => onShare(tag)}
                className="px-3 py-1 rounded-full text-sm border"
              >
                Look！
              </button>
            </div>
          ))}
        </div>

{/* ▼ カテゴリから探す */}
<div className="pt-4 border-t">
  <div className="text-sm font-bold mb-2">カテゴリから探す</div>

  {categoryLarges.length === 0 && (
    <div className="text-xs text-gray-500">
      大カテゴリマスタがまだ登録されていません。
    </div>
  )}

  <div className="space-y-2">
    {categoryLarges.map((large) => {
      const middles = categoryMiddles.filter(
        (m) => m.large_id === large.id
      );

      const isLargeOpen = openLargeId === large.id;

      return (
        <div
          key={large.id}
          className="rounded-xl border border-gray-200 bg-white"
        >
          {/* 大カテゴリ行：クリックで開閉 */}
          <button
            type="button"
            onClick={() =>
              setOpenLargeId((prev) => (prev === large.id ? null : large.id))
            }
            className="w-full flex items-center justify-between px-3 py-2"
          >
            <div className="flex-1 text-left">
              <div className="text-sm">{large.name_jp}</div>
              {large.description && (
                <div className="text-[11px] text-gray-500">
                  {large.description}
                </div>
              )}
              {large.name_en && (
                <div className="text-[11px] text-gray-400">
                  {large.name_en}
                </div>
              )}
            </div>
            <div className="ml-2 text-xs text-gray-500">
              {isLargeOpen ? "－" : "＋"}
            </div>
          </button>

          {/* ▼ 中カテゴリ + 小カテゴリ（大カテゴリが開いているときだけ） */}
          {isLargeOpen && (
            <div className="border-t border-gray-100">
              {middles.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-gray-400">
                  この大カテゴリには中カテゴリがありません。
                </div>
              )}

              {middles.map((mid) => {
                const smalls = categorySmalls.filter(
                  (s) => s.middle_id === mid.id
                );

                const isMiddleOpen = openMiddleId === mid.id;

                return (
                  <div key={mid.id} className="border-t border-gray-50">
                    {/* 中カテゴリ行：クリックで小カテゴリ一覧を開閉 */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMiddleId((prev) =>
                          prev === mid.id ? null : mid.id
                        )
                      }
                      className="w-full flex items-center justify-between px-4 py-2 bg-gray-50"
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm">{mid.name_jp}</div>
                        {mid.description && (
                          <div className="text-[11px] text-gray-500">
                            {mid.description}
                          </div>
                        )}
                        {mid.name_en && (
                          <div className="text-[11px] text-gray-400">
                            {mid.name_en}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 text-xs text-gray-500">
                        {isMiddleOpen ? "－" : "＋"}
                      </div>
                    </button>

                    {/* ▼ 小カテゴリ一覧（中カテゴリが開いているときだけ） */}
                    {isMiddleOpen && (
                      <div className="border-t border-gray-100">
                        {smalls.length === 0 && (
                          <div className="px-5 py-2 text-[11px] text-gray-400">
                            この中カテゴリには小カテゴリがありません。
                          </div>
                        )}

                        {smalls.map((small) => {
                          const isSmallOpen = openSmallId === small.id;

                          // ★ この小カテゴリの code を category_tag に持つ投稿のタグ一覧
                          const tagsForSmall =
                            tagCountByCategoryTag.get(small.code) ?? [];

                          return (
                            <div
                              key={small.id}
                              className="px-5 py-2 border-t border-gray-50"
                            >
                              {/* 小カテゴリ行（クリックでタグ一覧を開閉） */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSmallId((prev) =>
                                    prev === small.id ? null : small.id
                                  )
                                }
                                className="w-full flex items-center justify-between"
                              >
                                <div className="flex-1 text-left">
                                  <div className="text-sm">
                                    {small.name_jp}
                                  </div>
                                  {small.description && (
                                    <div className="text-[11px] text-gray-500">
                                      {small.description}
                                    </div>
                                  )}
                                  {small.name_en && (
                                    <div className="text-[11px] text-gray-400">
                                      {small.name_en}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2 text-xs text-gray-500">
                                  {isSmallOpen ? "▲" : "▼"}
                                </div>
                              </button>

                              {/* ▼ この小カテゴリに紐づくタグ一覧 */}
                              {isSmallOpen && (
                                <div className="mt-2 pl-2 space-y-1">
                                  {tagsForSmall.length === 0 && (
                                    <div className="text-[11px] text-gray-400">
                                      この小カテゴリのタグ付き投稿はまだありません。
                                    </div>
                                  )}

                                  {tagsForSmall.map(([tag, count]) => (
                                    <div
                                      key={tag}
                                      className="flex items-center gap-2"
                                    >
                                      <TagChip
                                        tag={`${tag}（${count}）`}
                                        onClick={() => onStartQuiz(tag)}
                                      />
                                      <button
                                        onClick={() => onStartQuiz(tag)}
                                        className="px-3 py-1 rounded-full text-xs bg-black text-white"
                                      >
                                        Answer
                                      </button>
                                      {/* 「タグから探す」と同じく Look! も付けたいなら */}
                                      <button
                                        onClick={() => onShare(tag)}
                                        className="px-3 py-1 rounded-full text-xs border"
                                      >
                                        Look！
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })}
  </div>

</div>


      </div>
    </Card>
  );
};


/* =========================
   クイズ実行
========================= */
type PreparedQuestion = {
  post: QuizPost;
  idx: number;
  // 出題用にシャッフルした選択肢 & 表示上の正解インデックス
  displayChoices?: string[];
  answerIndex?: number;
};
type QuizStage = "answering" | "revealed" | "finished";

// 選択肢シャッフル（Fisher–Yates）
const shuffleChoicesWithAnswer = (choices: string[], correctIndex: number) => {
  const idx = choices.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const displayChoices = idx.map((i) => choices[i]);
  const answerIndex = idx.indexOf(correctIndex);
  return { displayChoices, answerIndex };
};

// 追加：投稿配列専用ランナー
const AnswerRunner: React.FC<{
  posts: QuizPost[]; // その投稿に含まれる問題（1件～最大10件）
  title?: string;
  onBack: () => void;
  followIds: number[];                          // フォロー中ユーザーID一覧
  onToggleFollow: (targetUserId: number) => void; // フォロー/解除をトグル
}> = ({ posts, title = "この投稿に回答", onBack, followIds, onToggleFollow }) => {
  // 出題用に choice のみ選択肢をシャッフル
  const prepared = useMemo<PreparedQuestion[]>(() => {
    return posts.slice(0, 10).map((post, i) => {
      if (
        post.type === "choice" &&
        post.choices &&
        typeof post.correctIndex === "number"
      ) {
        const { displayChoices, answerIndex } = shuffleChoicesWithAnswer(
          post.choices,
          post.correctIndex
        );
        return { post, idx: i, displayChoices, answerIndex };
      }
      return { post, idx: i };
    });
  }, [posts]);

  const [current, setCurrent] = useState(0);
  const [stage, setStage] = useState<QuizStage>("answering");
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [manualCorrect, setManualCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const pq = prepared[current];
  const q = pq?.post;

    const firstPost = posts[0];
  const authorId = firstPost?.author_id ?? null;
  const isMyPost = authorId === CURRENT_USER_ID;

    const displayName = pickDisplayName(
    firstPost?.authorDisplayName,
    authorId ?? undefined
  );

    const ignosId =
    firstPost?.authorIgnosId ??
    (authorId === CURRENT_USER_ID && getCurrentUserIgnosId()) ??
    (authorId ? String(authorId) : "guest");

  const isFollowing =
    typeof authorId === "number" && followIds.includes(authorId);
    
  const canOK = useMemo(() => {
    if (!q) return false;
    return q.type === "choice" ? selected !== null : typed.trim().length > 0;
  }, [q, selected, typed]);

  const handleOK = () => {
    if (!q) return;
    if (q.type === "choice") {
      const isCorrect = selected === pq!.answerIndex;
      if (isCorrect) setCorrectCount((c) => c + 1);
      setStage("revealed");
    } else {
      setStage("revealed");
    }
  };

  const decideText = (res: boolean) => {
    if (manualCorrect !== null) return;
    setManualCorrect(res);
    if (res) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (current + 1 >= prepared.length) {
      setStage("finished");
      return;
    }
    setCurrent((c) => c + 1);
    setStage("answering");
    setSelected(null);
    setTyped("");
    setManualCorrect(null);
  };

  if (!q && stage !== "finished") {
    return (
      <Card>
        <SectionTitle title={title} />
        <div className="px-4 pb-4 text-gray-500">
          この投稿には問題がありません。
        </div>
      </Card>
    );
  }

  if (stage === "finished") {
    const total = prepared.length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <Card>
        <SectionTitle title={`${title}：リザルト`} />
        <div className="px-4 pb-4">
          <div className="text-5xl font-extrabold mb-2">{rate}%</div>
          <div className="text-gray-600 mb-6">
            正答率（{correctCount} / {prepared.length}）
          </div>
          <button
            onClick={onBack}
            className="w-full px-4 py-3 rounded-2xl bg-black text-white font-bold"
          >
            戻る
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle title={`${title}（${current + 1} / ${prepared.length}）`} />
      <div className="px-4 pb-4">
        <div className="text-base leading-relaxed mb-4 whitespace-pre-wrap">
          {q?.question}
        </div>

        {q?.type === "choice" ? (
          <div className="mb-4">
            {(pq?.displayChoices ?? q?.choices ?? []).map((c, i) => (
              <label
                key={i}
                className={`flex items-center gap-2 p-3 border rounded-2xl mb-2 ${
                  selected === i ? "border-black" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="accent-black"
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                />
                <span>{c}</span>
                {stage === "revealed" && pq?.answerIndex === i && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    正解
                  </span>
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="ここに解答を入力"
              className="w-full px-3 py-3 border rounded-2xl border-gray-200"
            />
          </div>
        )}

        {stage === "answering" ? (
          <button
            disabled={!canOK}
            onClick={handleOK}
            className={`w-full px-4 py-3 rounded-2xl font-bold ${
              canOK ? "bg-black text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            OK
          </button>
        ) : (
          <div>
            {q?.type === "choice" ? (
              <div className="mb-3">
                {selected === pq?.answerIndex ? (
                  <div className="text-green-600 font-bold">◎ 正解！</div>
                ) : (
                  <div className="text-red-600 font-bold">× 不正解</div>
                )}
              </div>
            ) : (
              <div className="mb-3">
                {typeof manualCorrect !== "boolean" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decideText(true)}
                      className="flex-1 px-4 py-2 rounded-2xl bg-green-600 text-white font-bold"
                    >
                      自分の答えは ○
                    </button>
                    <button
                      onClick={() => decideText(false)}
                      className="flex-1 px-4 py-2 rounded-2xl bg-red-600 text-white font-bold"
                    >
                      自分の答えは ×
                    </button>
                  </div>
                ) : (
                  <div
                    className={
                      manualCorrect
                        ? "text-green-600 font-bold"
                        : "text-red-600 font-bold"
                    }
                  >
                    {manualCorrect ? "○ と判定" : "× と判定"}
                  </div>
                )}
              </div>
            )}

            {(q?.type === "choice" || q?.modelAnswer) && (
              <div className="mb-2 text-sm">
                <div className="font-bold mb-1">模範解答</div>
                {q?.type === "choice" ? (
                  <div>
                    {
                      (pq?.displayChoices ?? q?.choices ?? [])[
                        pq?.answerIndex ?? 0
                      ]
                    }
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{q?.modelAnswer}</div>
                )}
              </div>
            )}
            {q?.note && (
              <div className="mb-4 text-sm text-gray-700 whitespace-pre-wrap">
                <div className="font-bold mb-1">補足</div>
                {q?.note}
              </div>
            )}

            <button
              onClick={next}
              className="w-full px-4 py-3 rounded-2xl font-bold bg-black text-white"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

// ランダム10問準備（choice はこの時点でシャッフル）
const pickRandom10 = (pool: QuizPost[]): PreparedQuestion[] => {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const slice = shuffled.slice(0, Math.min(10, shuffled.length));
  return slice.map((post, i) => {
    if (
      post.type === "choice" &&
      post.choices &&
      typeof post.correctIndex === "number"
    ) {
      const { displayChoices, answerIndex } = shuffleChoicesWithAnswer(
        post.choices,
        post.correctIndex
      );
      return { post, idx: i, displayChoices, answerIndex };
    }
    return { post, idx: i };
  });
};

const QuizRunner: React.FC<{
  tag: string;
  posts: QuizPost[];
  onBack: () => void;
    followIds: number[];
  onToggleFollow: (targetUserId: number) => void;
}> = ({ tag, posts, onBack, followIds, onToggleFollow }) => {
  const pool = useMemo(
    () => posts.filter((p) => p.hashtags.includes(tag)),
    [posts, tag]
  );
  const [questions, setQuestions] = useState<PreparedQuestion[]>(() =>
    pickRandom10(pool)
  );
  const [current, setCurrent] = useState(0);
  const [stage, setStage] = useState<QuizStage>("answering");
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [manualCorrect, setManualCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    setQuestions(pickRandom10(pool));
    setCurrent(0);
    setStage("answering");
    setSelected(null);
    setTyped("");
    setManualCorrect(null);
    setCorrectCount(0);
  }, [tag, posts.length]);

  const pq = questions[current];
  const q = pq?.post;

    const authorId =
    typeof q?.author_id === "number" ? (q.author_id as number) : null;
  const isMyPost = authorId === CURRENT_USER_ID;

  const displayName = pickDisplayName(
    q?.authorDisplayName,
    authorId ?? undefined
  );

  const ignosId =
    q?.authorIgnosId ??
    (authorId === CURRENT_USER_ID && getCurrentUserIgnosId()) ??
    (authorId ? String(authorId) : "guest");

  const isFollowing =
    typeof authorId === "number" && followIds.includes(authorId);

  const canOK = useMemo(() => {
    if (!q) return false;
    if (q.type === "choice") return selected !== null;
    return typed.trim().length > 0;
  }, [q, selected, typed]);

  const handleOK = () => {
    if (!q) return;
    if (q.type === "choice") {
      const isCorrect = selected === pq!.answerIndex;
      if (isCorrect) setCorrectCount((c) => c + 1);
      setStage("revealed");
    } else {
      setStage("revealed");
    }
  };

  const finalizeTextJudgement = (res: boolean) => {
    if (manualCorrect !== null) return;
    setManualCorrect(res);
    if (res) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      setStage("finished");
      return;
    }
    setCurrent((c) => c + 1);
    setStage("answering");
    setSelected(null);
    setTyped("");
    setManualCorrect(null);
  };

  const restart10 = () => {
    setQuestions(pickRandom10(pool));
    setCurrent(0);
    setStage("answering");
    setSelected(null);
    setTyped("");
    setManualCorrect(null);
    setCorrectCount(0);
  };

  if (!q && stage !== "finished") {
    return (
      <Card>
        <SectionTitle title={`${tag} の問題`} />
        <div className="px-4 pb-4 text-gray-500">
          問題が足りません。まずは投稿してみましょう。
        </div>
      </Card>
    );
  }

  if (stage === "finished") {
    const total = questions.length || 10;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <Card>
        <SectionTitle title={`${tag} のリザルト`} />
        <div className="px-4 pb-4">
          <div className="text-5xl font-extrabold mb-2">{rate}%</div>
          <div className="text-gray-600 mb-6">
            正答率（{correctCount} / {questions.length}）
          </div>
          <div className="flex gap-2">
            <button
              onClick={restart10}
              className="flex-1 px-4 py-3 rounded-2xl bg-black text-white font-bold"
            >
              次の10問を出題
            </button>
            <button
              onClick={onBack}
              className="flex-1 px-4 py-3 rounded-2xl bg-gray-100 font-bold"
            >
              戻る
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title={`${tag} の問題（${current + 1} / ${questions.length}）`}
      />
      <div className="px-4 pb-4">
        <div className="text-base leading-relaxed mb-4 whitespace-pre-wrap">
          {q?.question}
        </div>

        {q?.type === "choice" ? (
          <div className="mb-4">
            {(pq?.displayChoices ?? q?.choices ?? []).map((c, i) => (
              <label
                key={i}
                className={`flex items-center gap-2 p-3 border rounded-2xl mb-2 ${
                  selected === i ? "border-black" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="accent-black"
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                />
                <span>{c}</span>
                {stage === "revealed" && pq?.answerIndex === i && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    正解
                  </span>
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="ここに解答を入力"
              className="w-full px-3 py-3 border rounded-2xl border-gray-200"
            />
          </div>
        )}

        {stage === "answering" ? (
          <button
            disabled={!canOK}
            onClick={handleOK}
            className={`w-full px-4 py-3 rounded-2xl font-bold ${
              canOK ? "bg-black text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            OK
          </button>
        ) : (
          <div>
            {q?.type === "choice" ? (
              <div className="mb-3">
                {selected === pq?.answerIndex ? (
                  <div className="text-green-600 font-bold">◎ 正解！</div>
                ) : (
                  <div className="text-red-600 font-bold">× 不正解</div>
                )}
              </div>
            ) : (
              <div className="mb-3">
                {typeof manualCorrect !== "boolean" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => finalizeTextJudgement(true)}
                      className="flex-1 px-4 py-2 rounded-2xl bg-green-600 text-white font-bold"
                    >
                      自分の答えは ○
                    </button>
                    <button
                      onClick={() => finalizeTextJudgement(false)}
                      className="flex-1 px-4 py-2 rounded-2xl bg-red-600 text-white font-bold"
                    >
                      自分の答えは ×
                    </button>
                  </div>
                ) : (
                  <div
                    className={
                      manualCorrect
                        ? "text-green-600 font-bold"
                        : "text-red-600 font-bold"
                    }
                  >
                    {manualCorrect ? "○ と判定" : "× と判定"}
                  </div>
                )}
              </div>
            )}

            {(q?.type === "choice" || q?.modelAnswer) && (
              <div className="mb-2 text-sm">
                <div className="font-bold mb-1">模範解答</div>
                {q?.type === "choice" ? (
                  <div>
                    {
                      (pq?.displayChoices ?? q?.choices ?? [])[
                        pq?.answerIndex ?? 0
                      ]
                    }
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{q?.modelAnswer}</div>
                )}
              </div>
            )}
            {q?.note && (
              <div className="mb-4 text-sm text-gray-700 whitespace-pre-wrap">
                <div className="font-bold mb-1">補足</div>
                {q?.note}
              </div>
            )}

            <button
              onClick={next}
              className="w-full px-4 py-3 rounded-2xl font-bold bg-black text-white"
            >
              次へ
            </button>

            

            {/* ▼ 出題者情報＋フォローボタン（追加部分） */}
            {authorId && (
              <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* アイコン（仮） */}
                  <div className="w-9 h-9 rounded-full bg-gray-300" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{displayName}</span>
                    <span className="text-xs text-gray-500">@{ignosId}</span>
                  </div>
                </div>

                {/* 自分自身の問題ならフォローボタンは出さない */}
                {!isMyPost && (
                  <button
                    type="button"
                    onClick={() =>
                      typeof authorId === "number" &&
                      onToggleFollow(authorId)
                    }
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isFollowing
                        ? "bg-gray-100 text-gray-800 border"
                        : "bg-black text-white"
                    }`}
                  >
                    {isFollowing ? "フォロー解除" : "フォローする"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

/* =========================
   メインアプリ
========================= */
export default function QuizApp() {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
const [globalPosts, setGlobalPosts] = useState<QuizPost[]>([]);

const postsForTags = useMemo(() => {
  const map = new Map<string, QuizPost>();
  posts.forEach((p) => map.set(p.id, p));
  globalPosts.forEach((p) => map.set(p.id, p));
  return Array.from(map.values());
}, [posts, globalPosts]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

    const [composerMode, setComposerMode] = useState<"create" | "edit">("create");
  const [editTargetPosts, setEditTargetPosts] = useState<QuizPost[] | null>(null);
  const [editFeedId, setEditFeedId] = useState<string | null>(null);

const [mode, setMode] = useState<
  | "home"
  | "folders"
  | "quiz"
  | "search"
  | "notifications"
  | "answer"
  | "profile"
  | "discussions"       // ★議論一覧
  | "discussionDetail"  // ★議論詳細
>("home");
  const [answerPool, setAnswerPool] = useState<QuizPost[] | null>(null);
  // const [hasApiData, setHasApiData] = useState(false);
  
  // 検索（ユーザー）関連 state
const [userKeyword, setUserKeyword] = useState<string>("");
const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
const [userSearching, setUserSearching] = useState(false);
const [userSearchError, setUserSearchError] = useState<string | null>(null);

  // 共有モーダル
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTag, setShareTag] = useState<string>("");
  const [shareMessage, setShareMessage] = useState<string>("");
  const [followIds, setFollowIds] = useState<number[]>([]);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  // フォロー中ユーザーID一覧
const [profilePosts, setProfilePosts] = useState<QuizPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
const [profileFollowingCount, setProfileFollowingCount] = useState(0);
const [profileFollowerCount, setProfileFollowerCount] = useState(0);
const [profileIsFollowing, setProfileIsFollowing] = useState(false);

const [categoryLarges, setCategoryLarges] = useState<CategoryLarge[]>([]);
const [categoryMiddles, setCategoryMiddles] = useState<CategoryMiddle[]>([]);
const [categorySmalls, setCategorySmalls] = useState<CategorySmall[]>([]);

const [isSidebarOpen, setSidebarOpen] = useState(false);
const [isToolsOpen, setToolsOpen] = useState(false);
const [bulkImportOpen, setBulkImportOpen] = useState(false);

const [discussions, setDiscussions] = useState<DiscussionSummary[]>([]);
const [discussionKeyword, setDiscussionKeyword] = useState("");
const [selectedDiscussion, setSelectedDiscussion] =
  useState<DiscussionDetail | null>(null);

const [isDiscussionComposerOpen, setIsDiscussionComposerOpen] = useState(false);
const [isOpinionComposerOpen, setIsOpinionComposerOpen] = useState(false);

 // ★ 公開範囲変更モーダル用 state
  const [visibilityModal, setVisibilityModal] = useState<{
    quizId: string;
    current: Visibility;
  } | null>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const openVisibilityModal = (quizId: string, current?: Visibility | null) => {
    const safeCurrent: Visibility = (current ?? 3) as Visibility; // デフォルト: グローバル
    setVisibilityModal({ quizId, current: safeCurrent });
  };

  const closeVisibilityModal = () => {
    setVisibilityModal(null);
  };

const handleChangeVisibility = async (v: Visibility) => {
  if (!visibilityModal) return;

  const quizId = visibilityModal.quizId;

  try {
    setIsUpdatingVisibility(true);

    // 1) API で公開範囲を更新
    await updateQuizVisibility(quizId, v);

    // 2) posts / globalPosts の visibility を更新
    setPosts((prev) =>
      prev.map((p) => (p.id === quizId ? { ...p, visibility: v } : p))
    );
    setGlobalPosts((prev) =>
      prev.map((p) => (p.id === quizId ? { ...p, visibility: v } : p))
    );

    // 3) ★ feed の中の該当投稿も更新（単発 / まとめ両方）
    setFeed((prev) =>
      prev.map((item) => {
        if (item.kind === "quiz") {
          // 単発投稿
          const quiz = item.data as QuizPost;
          if (quiz.id !== quizId) return item;
          return {
            ...item,
            data: { ...quiz, visibility: v },
          };
        }

        if (item.kind === "quizBundle") {
          // まとめ投稿：中の配列のうち該当クイズだけ visibility 更新
          const updatedBundle = item.data.map((p) =>
            p.id === quizId ? { ...p, visibility: v } : p
          );
          return {
            ...item,
            data: updatedBundle,
          };
        }

        // share など他の種類はそのまま
        return item;
      })
    );

    // 4) モーダルを閉じる
    setVisibilityModal(null);
  } catch (e) {
    console.error(e);
    alert("公開範囲の変更に失敗しました。");
  } finally {
    setIsUpdatingVisibility(false);
  }
};


// QuizApp コンポーネント内

const loadQuizzesAndFeed = async () => {
  try {
    const rows = await getQuizzes(CURRENT_USER_ID);
    const apiPosts: QuizPost[] = rows.map(fromQuizRow);

    setPosts(apiPosts);
const authorSummary = apiPosts.reduce<Record<number, number>>((acc, p) => {
  const id = p.author_id ?? -1; // author_id が undefined の場合は -1 カウント
  acc[id] = (acc[id] ?? 0) + 1;
  return acc;
}, {});

console.log("DEBUG /quizzes author summary =", authorSummary);

    // ここから feed を構築（今 useEffect に書いてあるロジックをそのまま移動）
    const byBundle = new Map<string, QuizPost[]>();
    const singles: QuizPost[] = [];

    for (const p of apiPosts) {
      if (p.bundleId) {
        const key = p.bundleId;
        const list = byBundle.get(key) ?? [];
        list.push(p);
        byBundle.set(key, list);
      } else {
        singles.push(p);
      }
    }

    const feedItems: FeedItem[] = [];

    for (const [bundleId, postsInBundle] of byBundle) {
      if (postsInBundle.length >= 2) {
        postsInBundle.sort((a, b) => a.bundleOrder - b.bundleOrder);

        const createdAt = postsInBundle[0].createdAt;
        feedItems.push({
          id: `bundle_${bundleId}`,
          kind: "quizBundle",
          data: postsInBundle,
          createdAt,
          likes: 0,
          retweets: 0,
          answers: 0,
        });
      } else {
        singles.push(postsInBundle[0]);
      }
    }

    for (const p of singles) {
      feedItems.push({
        id: p.id,
        kind: "quiz",
        data: p,
        createdAt: p.createdAt,
        likes: 0,
        retweets: 0,
        answers: 0,
      });
    }

    feedItems.sort((a, b) => b.createdAt - a.createdAt);
    setFeed(feedItems);
  } catch (e) {
    console.error("API /quizzes 取得に失敗しました", e);
  }
};

// 議論API呼び出し関数
const loadDiscussions = async () => {
  const list = await fetchDiscussions(discussionKeyword || undefined);
  setDiscussions(list);
};

const openDiscussion = async (id: number) => {
  const detail = await fetchDiscussionDetail(id);  // ★ 引数は1つだけ
  setSelectedDiscussion(detail);
  setMode("discussionDetail");
};

const handleCreateDiscussion = async (payload: {
  title: string;
  agenda: string;
  tags: string[];
}) => {
  try {
    const created = await createDiscussion(payload);
    // 一覧に即時反映（先頭に追加）
    setDiscussions((prev) => [created, ...prev]);
    // モーダルを閉じる
    setIsDiscussionComposerOpen(false);
  } catch (e) {
    console.error("Failed to create discussion", e);
    // 必要なら alert など
  }
};


const handleCreateOpinion = async (payload: { body: string }) => {
  if (!selectedDiscussion) return;
  try {
    const opinion = await createOpinion(selectedDiscussion.id, payload);
    setSelectedDiscussion((prev) =>
      prev
        ? { ...prev, opinions: [opinion, ...prev.opinions] }
        : prev
    );
    setIsOpinionComposerOpen(false);
  } catch (e) {
    console.error("Failed to create opinion", e);
  }
};



const handleVoteOpinion = async (opinionId: number, vote: VoteKind) => {
  await voteOpinion(opinionId, vote);
  if (selectedDiscussion) {
    const detail = await fetchDiscussionDetail(selectedDiscussion.id);
    setSelectedDiscussion(detail);
  }
};



useEffect(() => {
  if (!CURRENT_USER_ID) return; // 未ログインなら何もしない

  (async () => {
    try {
      const res = await fetch(
        `${API_BASE}/follows?viewer_id=${encodeURIComponent(
          String(CURRENT_USER_ID)
        )}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        console.error("follows fetch failed status =", res.status);
        return;
      }

      const json = await res.json();
      const ids: number[] = json.ids ?? [];
      setFollowIds(ids);
      console.log("DEBUG followIds =", ids);
    } catch (e) {
      console.error("follows fetch failed", e);
    }
  })();
}, []);

useEffect(() => {
  loadQuizzesAndFeed();
}, []);

useEffect(() => {
  const loadGlobalQuizzes = async () => {
    try {
      const rows = await getGlobalQuizzes();
      const apiPosts = rows.map(fromQuizRow);
      setGlobalPosts(apiPosts);
    } catch (e) {
      console.error("API /quizzes/global 取得に失敗しました", e);
    }
  };

  loadGlobalQuizzes();
}, []);

// 一定時間ごとに最新投稿を取得（例：60秒）
useEffect(() => {
  if (!CURRENT_USER_ID) return; // 未ログインなら何もしない

  const intervalId = window.setInterval(() => {
    // ここでは単純に全体を再ロード
    loadQuizzesAndFeed();
  }, 30_000); // 30秒ごと

  return () => {
    window.clearInterval(intervalId);
  };
}, []);

useEffect(() => {
  const fetchCategories = async () => {
    try {
      const [larges, middles, smalls] = await Promise.all([
        getCategoryLarges(),
        getCategoryMiddles(),
        getCategorySmalls(),      // ★ 追加
      ]);
      setCategoryLarges(larges);
      setCategoryMiddles(middles);
      setCategorySmalls(smalls);  // ★ 追加
      console.log("DEBUG categoryLarges =", larges);
      console.log("DEBUG categoryMiddles =", middles);
      console.log("DEBUG categorySmalls =", smalls);
    } catch (e) {
      console.error("カテゴリ取得に失敗しました", e);
    }
  };

  fetchCategories();
}, []);

  const startQuiz = (tag: string) => {
    setSelectedTag(tag);
    setMode("quiz");
  };

const openProfile = async (userId?: number | null) => {
  console.log("openProfile userId =", userId);
  if (!userId || userId === 0) return;

  setProfileUserId(userId);
  setMode("profile");

  setProfileLoading(true);
  setProfileError(null);
  setProfilePosts([]);
  setProfileFollowingCount(0);
  setProfileFollowerCount(0);
setProfileIsFollowing(false);
  try {
    // ① プロフィール対象ユーザーの投稿取得
    const rows = await getUserQuizzes(userId);
    const apiPosts: QuizPost[] = rows.map(fromQuizRow);
    setProfilePosts(apiPosts);

    // ② フォロー数／フォロワー数/フォロー状態
        const statsRes = await fetch(
      `${API_BASE}/users/${userId}/follow-stats?viewer_id=${CURRENT_USER_ID ?? 0}`,
      {
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }
    );
    if (statsRes.ok) {
      const json = await statsRes.json();
      setProfileFollowingCount(json.following_count);
      setProfileFollowerCount(json.follower_count);
      setProfileIsFollowing(!!json.is_following);
    }

  } catch (e) {
    console.error("openProfile failed", e);
    setProfileError("プロフィール情報の取得に失敗しました");
  } finally {
    setProfileLoading(false);
  }
};


const handleUserSearch = async () => {
  const q = userKeyword.trim();
  if (!q) {
    setUserResults([]);
    setUserSearchError(null);
    return;
  }

  setUserSearching(true);
  setUserSearchError(null);

  try {
    const users = await searchUsers(q);
    setUserResults(users);
  } catch (e) {
    console.error(e);
    setUserSearchError("ユーザー検索に失敗しました");
  } finally {
    setUserSearching(false);
  }
};

const toggleFollow = async (targetId: number) => {
  if (!CURRENT_USER_ID || !targetId) return;

  try {
    const res = await fetch(`${API_BASE}/follows/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        target_user_id: targetId,
      }),
    });

    if (!res.ok) {
      console.error("toggleFollow failed status =", res.status);
      return;
    }

    const json = await res.json();
    const following: boolean = !!json.following;

    setFollowIds((prev) => {
      if (following) {
        if (prev.includes(targetId)) return prev;
        return [...prev, targetId];
      } else {
        return prev.filter((id) => id !== targetId);
      }
    });

    if (profileUserId === targetId) {
      setProfileIsFollowing(following);
      setProfileFollowerCount((prev) =>
        following ? prev + 1 : Math.max(0, prev - 1)
      );
    }

    // ★ フォロー状態が変わったので、ホーム用のクイズ/フィードを再取得
    // await loadQuizzesAndFeed();

  } catch (e) {
    console.error("toggleFollow failed", e);
  }
};




  const backToFolders = () => setMode("folders");

  // 追加：単発/まとめ投稿の編集結果を適用（追加・更新・削除を反映）
  const applyEditBundle = ({
    posts: updatedPosts,
    deletedIds,
  }: {
    posts: QuizPost[];
    deletedIds: string[];
  }) => {
    // ① posts state を更新（削除 + 更新 + 追加）
    setPosts((prev) => {
      const deletedSet = new Set(deletedIds);
      const updatedMap = new Map(updatedPosts.map((p) => [p.id, p]));

      // 既存のうち「削除されていない」ものを残しつつ、更新対象は差し替え
      const kept = prev
        .filter((p) => !deletedSet.has(p.id))
        .map((p) => updatedMap.get(p.id) ?? p);

      // prev に存在しなかった新規ID（編集で追加された問題）を append
      const prevIds = new Set(prev.map((p) => p.id));
      const added = updatedPosts.filter((p) => !prevIds.has(p.id));

      return [...kept, ...added];
    });

    // ② feed を更新（単発 / まとめ両対応）
    setFeed((prev) =>
      prev
        .map((item) => {
          if (item.id !== editFeedId) return item;

          if (item.kind === "quiz") {
            // 単発編集：0件（全削除）の場合は後で feed からも消す
            return updatedPosts[0]
              ? { ...item, data: updatedPosts[0] }
              : item;
          }

          if (item.kind === "quizBundle") {
            // まとめ編集：data を差し替え
            return { ...item, data: updatedPosts };
          }

          return item;
        })
        .filter((item) => {
          // 単発投稿が削除された場合：updatedPosts が空なら feed からも削除
          if (item.id === editFeedId && item.kind === "quiz") {
            return updatedPosts.length > 0;
          }
          // まとめ投稿で全問削除されてしまった場合：feed から削除
          if (item.id === editFeedId && item.kind === "quizBundle") {
            const bundle = item as FeedQuizBundleItem;
            return bundle.data.length > 0;
          }
          return true;
        })
    );

    // ③ DB: 更新されたものは upsert、削除されたものは delete
    bulkUpsertQuizzes(updatedPosts.map(toQuizRow)).catch(() => {});
    deleteQuizzes(deletedIds).catch(() => {});
  };




  // 追加：まとめて投稿
  const addPostBundle = (bundle: QuizPost[]) => {
    // posts には問題を全て展開して格納
    setPosts((prev) => [...bundle, ...prev]);

    // feed は1アイテム（quizBundle）として登録
    const createdAt = bundle[0]?.createdAt ?? Date.now();
    const item: FeedQuizBundleItem = {
      id: uid(),
      kind: "quizBundle",
      data: bundle,
      createdAt,
      likes: 0,
      retweets: 0,
      answers: 0,
    };
    setFeed((prev) => [item, ...prev]);
    // 2) APIへ fire-and-forget 保存（失敗は無視）
    bulkUpsertQuizzes(bundle.map(toQuizRow)).catch(() => {});
    postFeed(toFeedRow(item as any)).catch(() => {});
  };

  const handleBulkImported = (newPosts: QuizPost[]) => {
  if (!newPosts.length) return;

  // 1) posts に追加
  setPosts((prev) => [...newPosts, ...prev]);

  // 2) feed にも追加（単発投稿として扱う）
  const newFeedItems: FeedItem[] = newPosts.map((p) => ({
    id: p.id,
    kind: "quiz",
    data: p,
    createdAt: p.createdAt,
    likes: 0,
    retweets: 0,
    answers: 0,
  }));
  setFeed((prev) => [...newFeedItems, ...prev]);

  // 3) DB に保存
  bulkUpsertQuizzes(newPosts.map(toQuizRow)).catch(() => {});
};


const visibleFeed = useMemo(() => {
  // /api/quizzes が viewer_id に応じて
  // 「自分の全投稿＋フォロー中ユーザーの visibility != 1 の投稿」
  // だけを返しているので、ここでは追加の絞り込みを行わない
  return feed;
}, [feed]);


  // 共有フロー
  const openShare = (tag: string) => {
    setShareTag(tag);
    setShareMessage(`${tag}の問題を公開しました！`);
    setShareOpen(true);
  };
  const confirmShare = () => {
    const item: SharePost = {
      id: uid(),
      kind: "share",
      tag: shareTag,
      message: `${shareMessage} （リンク）`,
      createdAt: Date.now(),
      likes: 0,
      retweets: 0,
    };
    setFeed((prev) => [item, ...prev]);
    setShareOpen(false);
    setMode("home");

    postFeed(toFeedRow(item as any)).catch(() => {});
  };

const openEditForFeedItem = (item: FeedItem) => {
  if (item.kind === "quiz") {
    // 単発 → 配列1件として扱う
    setEditTargetPosts([item.data]);
  } else if (item.kind === "quizBundle") {
    // まとめ投稿 → そのまま配列で
    setEditTargetPosts(item.data);
  } else {
    // share は編集対象外
    return;
  }

  setEditFeedId(item.id);
  setComposerMode("edit");
  setComposerOpen(true);
};


  const incLike = (id: string) => {
    setFeed((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, likes: (it as any).likes + 1 } : it
      )
    );
    patchFeed(id, "likes").catch(() => {}); // ← 変更
  };

  const incRT = (id: string) => {
    setFeed((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, retweets: (it as any).retweets + 1 } : it
      )
    );
    patchFeed(id, "retweets").catch(() => {}); // ← 変更
  };

  const incAnswer = (id: string) => {
    setFeed((prev) =>
      prev.map((it) =>
        (it.kind === "quiz" || it.kind === "quizBundle") && it.id === id
          ? { ...it, answers: (it as any).answers + 1 }
          : it
      )
    );
    patchFeed(id, "answers").catch(() => {}); // ← 変更
  };

  const toggleMark = (feedId: string) => {
  setFeed((prev) =>
    prev.map((item) =>
      item.id === feedId
        ? { ...item, isMarked: !item.isMarked }
        : item
    )
  );
};
  const activeTab = mode;

  return (
    // 背景色切り替え
    // bg-white 真っ白
    // bg-[#FAF9F6] 紙の質感に近い
    // bg-[#F7F3E9] 少しクリーム寄り
    // bg-[#FDFCF7] 現代Webアプリで使われるナチュラル系
    <div className="min-h-[100dvh] bg-[#FAF9F6] text-gray-900 pb-16">
      <Header
  onOpenSidebar={() => setSidebarOpen(true)}
  onOpenTools={() => setToolsOpen(true)}
/>

      <div className="max-w-md mx-auto">
        {/* HOME */}
        {mode === "home" && (
          <Card>
            {/* ホーム */}
            <SectionTitle title="" />
            <div className="px-4 pb-4">
              {visibleFeed.length === 0 && (
                <div className="text-gray-500 text-sm">
                  まだ投稿がありません。「投稿」から作成してみましょう。
                </div>
              )}
              {visibleFeed.map((item) => (
                <div key={item.id} className="py-1 border-b border-gray-200 last:border-b-0">
                  {item.kind === "quiz" ? (
  <QuizPostCard
    post={item.data}
    feedId={item.id}
    likes={item.likes}
    retweets={item.retweets}
    answers={item.answers}
    isMarked={(item as any).isMarked ?? false}
    createdAtOverride={item.createdAt}
    onAnswer={() => {
      incAnswer(item.id);
      setAnswerPool([item.data]);
      setMode("answer");
    }}
    onLike={() => incLike(item.id)}
    onRT={() => incRT(item.id)}
    onToggleMark={() => toggleMark(item.id)}
    isMine={item.data.author_id === CURRENT_USER_ID}
    onEdit={
      item.data.author_id === CURRENT_USER_ID
        ? () => openEditForFeedItem(item)
        : undefined
    }
    onOpenProfile={(authorId) => openProfile(authorId as number)}
    onTagClick={(tag) => startQuiz(tag)}
    visibility={item.data.visibility}
    onClickVisibility={() =>
      openVisibilityModal(item.data.id, item.data.visibility)
    }
  />
) : item.kind === "quizBundle" ? (
  (() => {
    const first = item.data[0];

    const displayName = pickDisplayName(
      first?.authorDisplayName,
      first?.author_id
    );

    const ignosId =
      first?.authorIgnosId ??
      (first?.author_id === CURRENT_USER_ID && getCurrentUserIgnosId()) ??
      (first?.author_id ? String(first.author_id) : "guest");

    // このまとめ投稿に含まれるタグをすべて集約（重複削除）
    const bundleTags = Array.from(
      new Set(item.data.flatMap((q) => q.hashtags ?? []))
    );
    const mainBundleTag = bundleTags[0];
    const hasMoreBundleTags = bundleTags.length > 1;

    // 先頭タグからまとめタイトルを作る（なければ1問目）
    const mainTag = first?.hashtags?.[0];
    const bundleTitle =
      mainTag != null && mainTag !== ""
        ? `${mainTag}に関する問題`
        : first?.question ?? "クイズ（複数）";

    // 回答開始ハンドラ
    const handleAnswer = () => {
      incAnswer(item.id);
      setAnswerPool(item.data);
      setMode("answer");
    };

return (
  <>
    {/* ▼ ヘッダー行：ユーザー情報のみ */}
    <div className="flex items-start justify-between gap-2 mb-1">
      {/* 先頭問題のユーザー行 */}
      <button
        type="button"
        onClick={() => openProfile(first?.author_id)}
        className="flex items-center gap-2"
      >
        <div className="w-9 h-9 rounded-full bg-gray-300" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-bold">{displayName}</span>
          <span className="text-xs text-gray-500">@{ignosId}</span>
        </div>
      </button>
    </div>

    {/* ▼ タグ + 公開範囲アイコン行 */}
    {(mainBundleTag || first?.visibility != null) && (
      <div className="flex items-center justify-between mb-2">
        {/* 左：代表タグ＋「…」 */}
        <div className="flex items-center gap-1 max-w-[70%] overflow-hidden whitespace-nowrap">
          {mainBundleTag && (
            <TagChip
              key={mainBundleTag + item.id}
              tag={mainBundleTag}
              onClick={() => startQuiz(mainBundleTag)}
            />
          )}
          {hasMoreBundleTags && (
            <span className="text-xs text-gray-500 align-middle">…</span>
          )}
        </div>

        {/* 右：公開範囲アイコン（先頭問題の visibility を代表として使用） */}
        <button
          type="button"
          className="ml-2 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (!first) return;
            // ★ QuizApp 内で定義した openVisibilityModal を呼ぶ
            openVisibilityModal(first.id, first.visibility);
          }}
        >
          <VisibilityIcon value={first.visibility ?? null} />
        </button>
      </div>
    )}

    {/* ▼ タイトル部分：タップで回答開始（この下は今のままでOK） */}
    <div
      className="text-[15px] whitespace-pre-wrap mb-2 cursor-pointer"
      onClick={handleAnswer}
    >
      {bundleTitle}
    </div>
    <div
      className="text-xs text-gray-500 mb-2 cursor-pointer"
      onClick={handleAnswer}
    >
      全{item.data.length}問
    </div>

    <ActionBar
      likes={item.likes}
      retweets={item.retweets}
      answers={item.answers}
      onLike={() => incLike(item.id)}
      onRT={() => incRT(item.id)}
      onAnswer={handleAnswer}
      isMarked={item.isMarked ?? false}
      onToggleMark={() => toggleMark(item.id)}
      isMine={first?.author_id === CURRENT_USER_ID}
      onEdit={
        first?.author_id === CURRENT_USER_ID
          ? () => openEditForFeedItem(item)
          : undefined
      }
      createdAtText={formatDateYMD(item.createdAt)}
    />
  </>
);

  })()
) : (



  /* share の描画はそのままでOK */

                    <>
                      <div className="text-[15px] whitespace-pre-wrap mb-2">
                        {item.message}
                      </div>
                      <div className="mb-2">
                        <button
                          onClick={() => startQuiz(item.tag)}
                          className="px-3 py-1 rounded-full bg-black text-white text-sm"
                        >
                          クイズリンクを開く
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()} ・ 共有
                      </div>
                      <ActionBar
                        likes={item.likes}
                        retweets={item.retweets}
                        onLike={() => incLike(item.id)}
                        onRT={() => incRT(item.id)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* FOLDERS */}
        {mode === "folders" && (
          <FolderList
            posts={postsForTags}
            onStartQuiz={startQuiz}
            onShare={openShare}
            // categoryTree={[]}
            categoryLarges={categoryLarges}
            categoryMiddles={categoryMiddles}
            categorySmalls={categorySmalls}
          />
        )}

     {/* DISCUSSIONS：議論一覧 */}
      {mode === "discussions" && (
        <DiscussionList
          keyword={discussionKeyword}
          discussions={discussions}
          onKeywordChange={setDiscussionKeyword}
          onSearch={loadDiscussions}
          onSelectDiscussion={openDiscussion}
          onOpenComposer={() => setIsDiscussionComposerOpen(true)}
        />
      )}

      {/* DISCUSSION DETAIL：議論詳細 */}
      {mode === "discussionDetail" && selectedDiscussion && (
        <DiscussionDetailView
          detail={selectedDiscussion}
          onBack={() => setMode("discussions")}
          onOpenOpinionComposer={() => setIsOpinionComposerOpen(true)}
          onVote={handleVoteOpinion}
        />
      )}

        {/* QUIZ */}
{mode === "quiz" && selectedTag && (
  <QuizRunner
    tag={selectedTag}
    posts={postsForTags}
    onBack={backToFolders}
    followIds={followIds}
    onToggleFollow={toggleFollow}
  />
)}

{mode === "answer" && answerPool && (
  <AnswerRunner
    posts={answerPool}
    onBack={() => {
      setAnswerPool(null);
      setMode("home");
    }}
    followIds={followIds}
    onToggleFollow={toggleFollow}
  />
)}


{/* SEARCH：ユーザー検索 */}
{mode === "search" && (
  <Card>
    <SectionTitle title="ユーザー検索" />
    <div className="px-4 pb-4 space-y-3">

      {/* 検索フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          value={userKeyword}
          onChange={(e) => setUserKeyword(e.target.value)}
          placeholder="ユーザー名 / IgnosID を検索"
          className="flex-1 px-3 py-2 border rounded-xl text-sm bg-gray-50 border-gray-200"
        />
        <button
          type="button"
          onClick={handleUserSearch}
          className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold"
        >
          検索
        </button>
      </div>

      {userSearchError && (
        <div className="text-xs text-red-500">{userSearchError}</div>
      )}

      {userSearching && (
        <div className="text-sm text-gray-500">検索中です…</div>
      )}

      {/* 検索結果リスト */}
      <div className="divide-y divide-gray-200">
        {userResults.map((u) => {
          const displayName = u.display_name || "ゲスト";
          const ignosId = u.ignos_id || String(u.id);

          return (
            <button
              key={u.id}
              type="button"
              onClick={() => openProfile(u.id)}
              className="w-full flex items-center gap-3 py-3 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-gray-300" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold">{displayName}</span>
                <span className="text-xs text-gray-500">@{ignosId}</span>
              </div>
            </button>
          );
        })}

        {!userSearching &&
          userKeyword.trim() !== "" &&
          userResults.length === 0 && (
            <div className="py-3 text-sm text-gray-500">
              該当するユーザーが見つかりませんでした。
            </div>
          )}
      </div>
    </div>
  </Card>
)}


        {/* NOTIFICATIONS（プレースホルダー） */}
        {mode === "notifications" && (
          <Card>
            <SectionTitle title="通知" />
            <div className="px-4 pb-4 text-sm text-gray-600">
              共有やいいね・RTの通知をここに表示できます。
            </div>
          </Card>
        )}

        {/* PROFILE */}
{mode === "profile" && profileUserId !== null && (
  <>
    {profileLoading && (
      <Card>
        <div className="px-4 py-4 text-sm text-gray-500">
          プロフィールを読み込み中です…
        </div>
      </Card>
    )}

    {profileError && !profileLoading && (
      <Card>
        <div className="px-4 py-4 text-sm text-red-500">
          {profileError}
        </div>
      </Card>
    )}

    {!profileLoading && !profileError && (
<ProfileScreen
  userId={profileUserId}
  posts={profilePosts}
  isFollowing={profileIsFollowing}
  followingCount={profileFollowingCount}
  followerCount={profileFollowerCount}
  onToggleFollow={() => toggleFollow(profileUserId)}
  onBack={() => setMode("home")}
  onStartAnswer={(posts) => {
          setAnswerPool(posts);
          setMode("answer");
        }}
/>


    )}
  </>
)}

        <div className="h-4" />
      </div>

      {/* 投稿モーダル */}
      <Modal open={composerOpen} onClose={() => setComposerOpen(false)}>
  <Composer
    mode={composerMode}
    initialPosts={composerMode === "edit" ? editTargetPosts : null}
    onPostBundle={addPostBundle}        // 新規投稿
    onEditBundle={applyEditBundle}      // 編集（単発・まとめ両方）
    onCancel={() => setComposerOpen(false)}
  />
</Modal>

<Modal open={visibilityModal != null} onClose={closeVisibilityModal}>
  <div
    className="
      w-full max-w-xs mx-auto
      mt-24 mb-8
      p-4
      bg-white rounded-2xl shadow-lg border border-gray-200
      space-y-4
    "
  >
    <h2 className="text-base font-semibold">公開範囲の変更</h2>

    <div className="space-y-2">
      {[
        { value: 1 as Visibility, label: "プライベート", desc: "あなたのみ見ることができます" },
        { value: 2 as Visibility, label: "フォロワー限定", desc: "フォロワーに公開" },
        { value: 3 as Visibility, label: "グローバル", desc: "全てのユーザーに公開" },
      ].map((opt) => {
        const isSelected = visibilityModal?.current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isUpdatingVisibility}
            onClick={() => handleChangeVisibility(opt.value)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded border text-left text-sm
              ${isSelected ? "bg-gray-100 border-gray-400" : "border-gray-200"}
            `}
          >
            <span className="flex-shrink-0">
              <VisibilityIcon value={opt.value} size="sm" />
            </span>
            <span className="flex-1">
              <div className="font-medium">{opt.label}</div>
              <div className="text-[11px] text-gray-500">{opt.desc}</div>
            </span>
          </button>
        );
      })}
    </div>

    <button
      type="button"
      className="mt-1 w-full text-xs text-gray-500 underline"
      onClick={closeVisibilityModal}
      disabled={isUpdatingVisibility}
    >
      キャンセル
    </button>
  </div>
</Modal>



{/* JSON 一括投入モーダル（admin専用） */}
<Modal open={bulkImportOpen} onClose={() => setBulkImportOpen(false)}>
  <BulkImportDialog
    onClose={() => setBulkImportOpen(false)}
    onImported={handleBulkImported}
  />
</Modal>


      {/* 共有メッセージ編集モーダル */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)}>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            {shareTag} のフォルダを共有します。メッセージを編集できます。
          </div>
          <textarea
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
            className="w-full h-28 p-3 border rounded-xl"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShareOpen(false)}
              className="px-4 py-2 rounded-full bg-gray-100"
            >
              キャンセル
            </button>
            <button
              onClick={confirmShare}
              className="px-4 py-2 rounded-full bg-black text-white font-bold"
            >
              OK
            </button>
          </div>
        </div>
      </Modal>

     {/* ★議論用モーダル */}
      <DiscussionComposer
        open={isDiscussionComposerOpen}
        onClose={() => setIsDiscussionComposerOpen(false)}
        onSubmit={handleCreateDiscussion}
      />

      <OpinionComposer
        open={isOpinionComposerOpen}
        onClose={() => setIsOpinionComposerOpen(false)}
        onSubmit={handleCreateOpinion}
      />

      {/* ▶ ホーム画面用フローティング投稿ボタン（ブルースカイ風） ◀ */}
      {mode === "home" && (
        <button
onClick={() => {
            // ★ 新規投稿モードにリセットしてから開く
            setComposerMode("create");
            setEditTargetPosts(null);
            setEditFeedId(null);
            setComposerOpen(true);
          }}
          className="
            fixed
            bottom-20 right-4
            z-20
            w-14 h-14
            rounded-full
            bg-black
            text-white
            shadow-lg
            flex items-center justify-center
          "
          aria-label="投稿"
        >
          <img
            src={iconUrl("post")}
            alt="投稿"
            className="w-7 h-7"
          />
        </button>
      )}

      {mode === "discussions" && (
  <button
    className="fixed right-4 bottom-16 rounded-full px-4 py-3 shadow-lg bg-blue-500 text-white text-sm"
    onClick={() => setIsDiscussionComposerOpen(true)}
  >
    議題投稿
  </button>
)}

{mode === "discussionDetail" && (
  <button
    className="fixed right-4 bottom-16 rounded-full px-4 py-3 shadow-lg bg-blue-500 text-white text-sm"
    onClick={() => setIsOpinionComposerOpen(true)}
  >
    意見投稿
  </button>
)}

      {/* ボトムナビ */}
      <BottomNav
        active={activeTab}
          onHome={async () => {
    setMode("home");
    await loadQuizzesAndFeed(); // ★ ここで最新の投稿を取得
  }}
        onSearch={() => setMode("search")}
        onFolders={() => setMode("folders")}
          onDiscussions={() => {
    setMode("discussions");
    loadDiscussions();
  }}
        onNotify={() => setMode("notifications")}
  onProfile={() => {
    if (!CURRENT_USER_ID) return; // 未ログインなら何もしない
    openProfile(CURRENT_USER_ID);
  }}
      />

      {/* サイドバー（Bluesky 風） */}
{isSidebarOpen && (
  <div className="fixed inset-0 z-30 flex">
    {/* 左のサイドバー本体 */}
    <div className="w-72 max-w-[80%] h-full bg-white shadow-xl border-r border-gray-200 flex flex-col">
      <div className="h-12 px-4 flex items-center justify-between border-b border-gray-100">
        <span className="text-sm font-semibold">メニュー</span>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
          onClick={() => setSidebarOpen(false)}
        >
          ×
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 text-sm">
        {/* ここはお好みでメニュー項目を増やしてください */}
        <button
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
          onClick={() => {
            setMode("home");
            setSidebarOpen(false);
          }}
        >
          ホーム
        </button>
        <button
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
          onClick={() => {
            setMode("search");
            setSidebarOpen(false);
          }}
        >
          検索
        </button>
        <button
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
          onClick={() => {
            setMode("folders");
            setSidebarOpen(false);
          }}
        >
          タグから探す
        </button>
        {CURRENT_USER_ID && (
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
            onClick={() => {
              openProfile(CURRENT_USER_ID);
              setSidebarOpen(false);
            }}
          >
            マイプロフィール
          </button>
        )}
      </nav>
    </div>

    {/* 右側の半透明オーバーレイ：クリックで閉じる */}
    <button
      className="flex-1 h-full bg-black/30"
      onClick={() => setSidebarOpen(false)}
      aria-label="メニューを閉じる"
    />
  </div>
)}

{/* ツールパレット（右上ボタン用） */}
{isToolsOpen && (
  <div className="fixed inset-0 z-40 flex items-start justify-end pt-14 pr-3">
    {/* 背景をクリックすると閉じる */}
    <div
      className="absolute inset-0 bg-black/20"
      onClick={() => setToolsOpen(false)}
    />

    {/* パレット本体 */}
    <div className="relative z-10 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">ツール</span>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
          onClick={() => setToolsOpen(false)}
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
        {IS_ADMIN && (
          <button
            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 text-red-600"
            onClick={() => {
              setToolsOpen(false);
              setBulkImportOpen(true);
            }}
          >
            問題一括登録（JSON）
          </button>
        )}
      </div>
    </div>
  </div>
)}

    </div>
  );
}
