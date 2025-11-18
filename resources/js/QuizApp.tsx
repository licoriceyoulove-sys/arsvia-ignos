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
import { getQuizzes } from "./api/client";
import { fromQuizRow } from "./api/mapper";
import { bulkUpsertQuizzes, postFeed, patchFeed, API_BASE } from "./api/client";
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
import { Header } from "./components/layout/Header";
import { BottomNav } from "./components/layout/BottomNav";
import { Modal } from "./components/layout/Modal";

import { Card } from "./components/ui/Card";
import { SectionTitle } from "./components/ui/SectionTitle";
import { TagChip } from "./components/ui/TagChip";
import { ActionBar } from "./components/ui/ActionBar";

import { CURRENT_USER_ID, pickDisplayName } from "./utils/user";
console.log("DEBUG Current User ID =", CURRENT_USER_ID);

import { ProfileScreen } from "./components/profile/ProfileScreen";

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
  onPostBundle?: (posts: QuizPost[]) => void; // 追加：バンドル用
}> = ({ onCancel, onPostBundle }) => {

  const [sharedTags, setSharedTags] = useState<string>(""); // 共通タグ（全問題に適用）
  const [activeIdx, setActiveIdx] = useState<number>(0); // 表示中の問題インデックス
const [visibility, setVisibility] = useState<Visibility>(1);
  // 複数問題 用 state（最大10）
  type Draft = {
    type: QuizType;
    question: string;
    note: string;
    tagsInput: string;
    correctChoice: string;
    wrongChoices: string[];
    modelAnswer: string;
  };
  const makeEmptyDraft = (): Draft => ({
    type: "choice",
    question: "",
    note: "",
    tagsInput: "",
    correctChoice: "",
    wrongChoices: ["", ""],
    modelAnswer: "",
  });
  const [drafts, setDrafts] = useState<Draft[]>([makeEmptyDraft()]);

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
    if (!onPostBundle) return;
    const posts = drafts
      .map((d) => toQuizPostWithSharedTags(d, sharedTags, visibility))
      .filter(Boolean) as QuizPost[];
    if (posts.length === 0 || posts.length > 10) return;
    onPostBundle(posts);
    onCancel();
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

        {/* 真ん中はタイトル入れてもOK（今は空） */}
        <div className="text-sm font-bold" />

        <button
          disabled={!canPostMulti}
          onClick={submitMulti}
          className={`px-4 py-1 rounded-full text-sm font-bold ${
            canPostMulti ? "bg-black text-white" : "bg-gray-200 text-gray-400"
          }`}
        >
          投稿（{drafts.length}問）
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

        {/* ナビゲーション（＜ 問題 x/y ＞） */}
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
        <div>
          {drafts.length < 10 && (
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
          )}
        </div>
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

/* =========================
   フォルダ（タグ）一覧
========================= */
const FolderList: React.FC<{
  posts: QuizPost[];
  onStartQuiz: (tag: string) => void;
  onShare: (tag: string) => void;
}> = ({ posts, onStartQuiz, onShare }) => {
  const tagCount = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((p) =>
      p.hashtags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1))
    );
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  return (
    <Card>
      <SectionTitle title="タグから探す" />
      <div className="px-4 pb-4 space-y-2">
        {tagCount.length === 0 && (
          <div className="text-gray-500 text-sm">まだ投稿がありません</div>
        )}
        {tagCount.map(([tag, count]) => (
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
}> = ({ posts, title = "この投稿に回答", onBack }) => {
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
}> = ({ tag, posts, onBack }) => {
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
        <SectionTitle title={`${tag} のクイズ`} />
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
        title={`${tag} のクイズ（${current + 1} / ${questions.length}）`}
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
          </div>
        )}
      </div>
    </Card>
  );
};

/* =========================
   タイムラインのアクション
========================= */

/* =========================
   メインアプリ
========================= */
export default function QuizApp() {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const [mode, setMode] = useState<
    "home" | "folders" | "quiz" | "search" | "notifications" | "answer"  | "profile"
  >("home");
  const [answerPool, setAnswerPool] = useState<QuizPost[] | null>(null);
  const [hasApiData, setHasApiData] = useState(false);
  // 共有モーダル
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTag, setShareTag] = useState<string>("");
  const [shareMessage, setShareMessage] = useState<string>("");
  const [followIds, setFollowIds] = useState<number[]>([]);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  // フォロー中ユーザーID一覧
  // const [followIds, setFollowIds] = useState<number[]>([]);

  //   useEffect(() => {
  //   (async () => {
  //     try {
  //       const res = await axios.get("/api/following-ids");
  //       const ids: number[] = res.data?.ids ?? [];
  //       setFollowIds(ids);
  //       console.log("DEBUG followIds =", ids);
  //     } catch (e) {
  //       console.error("following-ids fetch failed", e);
  //     }
  //   })();
  // }, []);
// client.ts と同じように API_BASE を使うなら、先頭で import しておいてください。
// 例: import { API_BASE } from "./api/client";

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
    (async () => {
      try {
        const rows = await getQuizzes(CURRENT_USER_ID);
        const apiPosts: QuizPost[] = rows.map(fromQuizRow);

        // posts / feed を API の結果だけで構成
        setPosts(apiPosts);

        const apiFeed: FeedItem[] = apiPosts.map((p) => ({
          id: p.id,
          kind: "quiz",
          data: p,
          createdAt: p.createdAt,
          likes: 0,
          retweets: 0,
          answers: 0,
        }));
        setFeed(apiFeed);
      } catch (e) {
        console.error("API /quizzes 取得に失敗しました", e);
        // ここではフォールバックも何もせず「失敗ログだけ」にしておく
      }
    })();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const rows = await getQuizzes(CURRENT_USER_ID);
        const apiPosts: QuizPost[] = rows.map(fromQuizRow);

        // ★ APIにデータがあればフラグON
        if (apiPosts.length > 0) setHasApiData(true);

        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of apiPosts) if (!seen.has(p.id)) merged.push(p);
          return merged;
        });

        setFeed((prev) => {
          const have = new Set(prev.map((f) => f.id));
          const add = apiPosts
            .filter((p) => !have.has(p.id))
            .map((p) => ({
              id: p.id,
              kind: "quiz" as const,
              data: p,
              createdAt: p.createdAt,
              likes: 0,
              retweets: 0,
              answers: 0,
            }));
          return add.length ? [...add, ...prev] : prev;
        });
      } catch (e) {
        console.error("API init failed", e);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getQuizzes(CURRENT_USER_ID);
        console.log("API /quizzes ->", data); // ← ここに test1 などが出ればOK
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ② APIから取得して重複なしでマージ
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {

        // const apiPosts = rows.map(fromQuizRow);
        const rows = await getQuizzes(CURRENT_USER_ID);
        // ここを明示的に型付け
        const apiPosts: QuizPost[] = rows.map(fromQuizRow);
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of apiPosts) if (!seen.has(p.id)) merged.push(p);
          return merged;
        });

        setFeed((prev) => {
          const have = new Set(prev.map((f) => f.id));
          const add = apiPosts
            .filter((p) => !have.has(p.id))
            .map((p) => ({
              id: p.id,
              kind: "quiz" as const,
              data: p,
              createdAt: p.createdAt,
              likes: 0,
              retweets: 0,
              answers: 0,
            }));
          return add.length ? [...add, ...prev] : prev;
        });
      } catch (e) {
        console.error("API init failed", e);
      }
    })();
    return () => ac.abort();
  }, []);

  // ③ 変更があったらローカルへ保存（この2本だけでOK）
  // useEffect(() => savePosts(posts), [posts]);
  // useEffect(() => saveFeed(feed), [feed]);

  const startQuiz = (tag: string) => {
    setSelectedTag(tag);
    setMode("quiz");
  };

  const openProfile = (userId?: number | null) => {
  if (!userId || userId === 0) return;
  setProfileUserId(userId);
  setMode("profile");
};

const toggleFollow = (targetId: number) => {
  setFollowIds((prev) =>
    prev.includes(targetId)
      ? prev.filter((id) => id !== targetId)
      : [...prev, targetId]
  );
};

  const backToFolders = () => setMode("folders");

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

   const visibleFeed = useMemo(() => {
  // 自分のID + フォロー中ユーザーID
  const allowed = new Set<number>([CURRENT_USER_ID, ...followIds]);

  return feed.filter((item) => {
    // 共有投稿は常に表示
    if (item.kind === "share") return true;

    let authorId: number | null | undefined;

    if (item.kind === "quiz") {
      authorId = item.data.author_id;
    } else if (item.kind === "quizBundle") {
      authorId = item.data[0]?.author_id;
    }

    // ★ author_id が入っていない古い投稿は「自分の投稿扱い」で表示
    if (authorId == null) return true;

    // ★ allowed（自分＋フォロー中）に含まれる投稿だけ表示
    return allowed.has(authorId);
  });
}, [feed, followIds]);


  // 共有フロー
  const openShare = (tag: string) => {
    setShareTag(tag);
    setShareMessage(`${tag}のクイズを公開したよ！`);
    setShareOpen(true);
  };
  const confirmShare = () => {
    const item: SharePost = {
      id: uid(),
      kind: "share",
      tag: shareTag,
      message: `${shareMessage} （クイズリンク）`,
      createdAt: Date.now(),
      likes: 0,
      retweets: 0,
    };
    setFeed((prev) => [item, ...prev]);
    setShareOpen(false);
    setMode("home");

    postFeed(toFeedRow(item as any)).catch(() => {});
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

  const activeTab = mode;

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 pb-16">
      <Header />

      <div className="max-w-md mx-auto">
        {/* HOME */}
        {mode === "home" && (
          <Card>
            {/* ホーム */}
            <SectionTitle title="" />
            <div className="px-4 pb-4">
              {feed.length === 0 && (
                <div className="text-gray-500 text-sm">
                  まだ投稿がありません。「投稿」から作成してみましょう。
                </div>
              )}
              {feed.map((item) => (
                <div key={item.id} className="py-3 border-b last:border-b-0">
                  {item.kind === "quiz" ? (
  <>
    {/* ユーザー行 */}
    <button
      type="button"
      onClick={() => openProfile(item.data.author_id)}
      className="flex items-center gap-2 mb-2"
    >
      <div className="w-9 h-9 rounded-full bg-gray-300" />
      <div className="flex flex-col items-start">
        <span className="text-sm font-bold">
  {item.data.authorDisplayName ?? "ゲスト"}
</span>
        <span className="text-xs text-gray-500">
          @{item.data.authorIgnosId ?? "guest"}
        </span>
      </div>
    </button>

    <div className="text-[15px] whitespace-pre-wrap mb-2">
      {item.data.question}
    </div>
    <div className="flex flex-wrap mb-2">
      {item.data.hashtags.map((t) => (
        <TagChip
          key={t + item.id}
          tag={t}
          onClick={() => startQuiz(t)}
        />
      ))}
    </div>
    <div className="text-xs text-gray-500">
      {new Date(item.createdAt).toLocaleString()} ・{" "}
      {item.data.type === "choice" ? "選択肢" : "テキスト入力"}
    </div>
    <ActionBar
      likes={item.likes}
      retweets={item.retweets}
      answers={item.answers}
      onLike={() => incLike(item.id)}
      onRT={() => incRT(item.id)}
      onAnswer={() => {
        incAnswer(item.id);
        setAnswerPool([item.data]);
        setMode("answer");
      }}
    />
  </>
) : item.kind === "quizBundle" ? (
  // ↓このあとに続く quizBundle ブロックを書き換え

                    <>
  {/* バンドル投稿のユーザー行（先頭問題の author を利用） */}
  <button
    type="button"
    onClick={() =>
      openProfile(item.data[0]?.author_id ?? undefined)
    }
    className="flex items-center gap-2 mb-2"
  >
    <div className="w-9 h-9 rounded-full bg-gray-300" />
    <div className="flex flex-col items-start">
      <span className="text-sm font-bold">
  {item.data[0]?.authorDisplayName ?? "ゲスト"}
      </span>
      <span className="text-xs text-gray-500">
@{item.data[0]?.authorIgnosId ?? "guest"}
      </span>
    </div>
  </button>

  <div className="text-[15px] whitespace-pre-wrap mb-2">
    {item.data[0]?.question ?? "クイズ（複数）"}
  </div>
  <div className="text-xs text-gray-500 mb-2">
    全{item.data.length}問
  </div>
  <ActionBar
    likes={item.likes}
    retweets={item.retweets}
    answers={item.answers}
    onLike={() => incLike(item.id)}
    onRT={() => incRT(item.id)}
    onAnswer={() => {
      incAnswer(item.id);
      setAnswerPool(item.data);
      setMode("answer");
    }}
  />
</>

                  ) : (
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
            posts={posts}
            onStartQuiz={startQuiz}
            onShare={openShare}
          />
        )}

        {/* QUIZ */}
        {mode === "quiz" && selectedTag && (
          <QuizRunner tag={selectedTag} posts={posts} onBack={backToFolders} />
        )}

        {mode === "answer" && answerPool && (
          <AnswerRunner
            posts={answerPool}
            onBack={() => {
              setAnswerPool(null);
              setMode("home");
            }}
          />
        )}

        {/* SEARCH（プレースホルダー） */}
        {mode === "search" && (
          <Card>
            <SectionTitle title="検索" />
            <div className="px-4 pb-4 text-sm text-gray-600">
              今後ここでタグや問題文を検索できます。
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
          <ProfileScreen
            userId={profileUserId}
            posts={posts}
            isFollowing={followIds.includes(profileUserId)}
            followingCount={
              profileUserId === CURRENT_USER_ID ? followIds.length : 0
            }
            followerCount={0 /* TODO: API 連携で正確な数に */}
            onToggleFollow={() => toggleFollow(profileUserId)}
            onBack={() => setMode("home")}
          />
        )}


        <div className="h-4" />
      </div>

      {/* 投稿モーダル */}
      <Modal
  open={composerOpen}
  onClose={() => setComposerOpen(false)}
>
  <Composer
    onPostBundle={addPostBundle}
    onCancel={() => setComposerOpen(false)}
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

      {/* ▶ ホーム画面用フローティング投稿ボタン（ブルースカイ風） ◀ */}
      {mode === "home" && (
        <button
          onClick={() => setComposerOpen(true)}
          className="
            fixed
            bottom-20 right-4
            z-40
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

      {/* ボトムナビ */}
      <BottomNav
        active={activeTab}
        onHome={() => setMode("home")}
        onSearch={() => setMode("search")}
        onFolders={() => setMode("folders")}
        onNotify={() => setMode("notifications")}
  onProfile={() => {
    if (!CURRENT_USER_ID) return; // 未ログインなら何もしない
    setProfileUserId(CURRENT_USER_ID);
    setMode("profile");
  }}
      />
    </div>
  );
}
