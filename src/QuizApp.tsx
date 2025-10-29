import React, { useEffect, useMemo, useState } from "react";

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

/* =========================
   型定義
========================= */
export type QuizType = "choice" | "text";

export type QuizPost = {
  id: string;
  question: string;
  type: QuizType;
  // choice
  choices?: string[];
  correctIndex?: number;
  // text
  modelAnswer?: string;
  // 共通
  note?: string;
  hashtags: string[];
  createdAt: number;
};

// JSONファイルの1問分の型
export type QuizSeed = {
  question: string;
  type: "choice" | "text";
  choices?: string[];
  correctIndex?: number;
  modelAnswer?: string;
  note?: string;
  hashtags?: string[];
};

export type SharePost = {
  id: string;
  kind: "share";
  tag: string;
  message: string;
  createdAt: number;
  likes: number;
  retweets: number;
};

export type FeedQuizItem = {
  id: string;
  kind: "quiz";
  data: QuizPost;
  createdAt: number;
  likes: number;
  retweets: number;
  answers: number;
};

export type FeedQuizBundleItem = {
  id: string;
  kind: "quizBundle";
  data: QuizPost[]; // まとめて投稿された問題群
  createdAt: number;
  likes: number;
  retweets: number;
  answers: number;
};

export type FeedItem = FeedQuizItem | FeedQuizBundleItem | SharePost;

/* =========================
   永続化／ユーティリティ
========================= */
const LS_KEY_POSTS = "quiz_posts_v2";
const LS_KEY_FEED = "quiz_feed_v2";
const LS_KEY_SEEDED_CATEGORIES = "quiz_seeded_categories_v1";

const savePosts = (posts: QuizPost[]) =>
  localStorage.setItem(LS_KEY_POSTS, JSON.stringify(posts));
const loadPosts = (): QuizPost[] => {
  try {
    const raw = localStorage.getItem(LS_KEY_POSTS);
    return raw ? (JSON.parse(raw) as QuizPost[]) : [];
  } catch {
    return [];
  }
};

const saveFeed = (feed: FeedItem[]) =>
  localStorage.setItem(LS_KEY_FEED, JSON.stringify(feed));
const loadFeed = (): FeedItem[] => {
  try {
    const raw = localStorage.getItem(LS_KEY_FEED);
    return raw ? (JSON.parse(raw) as FeedItem[]) : [];
  } catch {
    return [];
  }
};

const loadSeededCats = (): string[] => {
  try {
    const raw = localStorage.getItem(LS_KEY_SEEDED_CATEGORIES);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};
const saveSeededCats = (cats: string[]) =>
  localStorage.setItem(LS_KEY_SEEDED_CATEGORIES, JSON.stringify(cats));

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

// 未投入カテゴリのみを QuizPost にして返す
const loadCategorySeedsAsPosts = (): {
  posts: QuizPost[];
  newlySeededKeys: string[];
} => {
  const seeded = new Set(loadSeededCats());
  const newPosts: QuizPost[] = [];
  const newly: string[] = [];

  for (const [path, mod] of Object.entries(CATEGORY_GLOB)) {
    const key = fileKeyToCategory(path); // 例: english
    if (seeded.has(key)) continue;

    const seeds = (mod?.default ?? []) as QuizSeed[];
    // #タグ省略時は #<filename> を自動付与
    const normalized = seeds.map((s) =>
      !s.hashtags || s.hashtags.length === 0
        ? { ...s, hashtags: [`#${key}`] }
        : s
    );

    const posts = seedsToPosts(normalized);
    newPosts.push(...posts);
    newly.push(key);
  }

  return { posts: newPosts, newlySeededKeys: newly };
};

/* =========================
   UI パーツ
========================= */
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={`w-full bg-white border-b border-gray-200 ${className ?? ""}`}
  >
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-2 font-bold text-gray-900 text-lg">{title}</div>
);

const TagChip: React.FC<{
  tag: string;
  onClick?: () => void;
  active?: boolean;
}> = ({ tag, onClick, active }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-sm mr-2 mb-2 border ${
      active
        ? "bg-black text-white border-black"
        : "bg-gray-50 text-gray-700 border-gray-200"
    }`}
  >
    {tag}
  </button>
);

const Header: React.FC = () => (
  <div className="sticky top-0 bg-white/90 backdrop-blur z-20 border-b border-gray-200">
    <div className="max-w-md mx-auto flex items-center justify-between px-4 h-12">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white font-bold">
          X
        </div>
        <div className="font-bold">SPHINX</div>
      </div>
      <div className="w-8" />
    </div>
  </div>
);

const BottomNav: React.FC<{
  active: string;
  onHome: () => void;
  onSearch: () => void;
  onFolders: () => void;
  onNotify: () => void;
  onPost: () => void;
}> = ({ active, onHome, onSearch, onFolders, onNotify, onPost }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
    <div className="max-w-md mx-auto grid grid-cols-5 text-xs">
      <button
        onClick={onHome}
        className={`py-3 ${active === "home" ? "text-black" : "text-gray-500"}`}
        aria-label="ホーム"
      >
        🏠<div>ホーム</div>
      </button>
      <button
        onClick={onSearch}
        className={`py-3 ${
          active === "search" ? "text-black" : "text-gray-500"
        }`}
        aria-label="検索"
      >
        🔍<div>検索</div>
      </button>
      <button
        onClick={onFolders}
        className={`py-3 ${
          active === "folders" ? "text-black" : "text-gray-500"
        }`}
        aria-label="クイズ"
      >
        🗂️<div>クイズ</div>
      </button>
      <button
        onClick={onNotify}
        className={`py-3 ${
          active === "notifications" ? "text-black" : "text-gray-500"
        }`}
        aria-label="通知"
      >
        🔔<div>通知</div>
      </button>
      <button onClick={onPost} className="py-3 text-black" aria-label="投稿">
        ✍️<div>投稿</div>
      </button>
    </div>
  </nav>
);

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-w-md mx-auto bg-white rounded-t-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 h-12 border-b">
          <div className="font-bold">{title ?? ""}</div>
          <button onClick={onClose} className="text-gray-500">
            閉じる
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const Composer: React.FC<{
  onPost: (post: QuizPost) => void; // 単問用（従来）
  onCancel: () => void;
  onPostBundle?: (posts: QuizPost[]) => void; // 追加：バンドル用
}> = ({ onPost, onCancel, onPostBundle }) => {
  const [multi, setMulti] = useState<boolean>(false); // ← まとめて投稿モード

  // 単問 用 state（以前のもの）
  const [type, setType] = useState<QuizType>("choice");
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [correctChoice, setCorrectChoice] = useState<string>("");
  const [wrongChoices, setWrongChoices] = useState<string[]>(["", ""]);
  const [modelAnswer, setModelAnswer] = useState("");
  const [sharedTags, setSharedTags] = useState<string>(""); // 共通タグ（全問題に適用）
  const [activeIdx, setActiveIdx] = useState<number>(0); // 表示中の問題インデックス

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

  const toQuizPost = (d: Draft): QuizPost | null => {
    if (!d.question.trim()) return null;
    const tags = parseHashtags(d.tagsInput);
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
        hashtags: tags,
        createdAt: Date.now(),
      };
    } else {
      if (!d.modelAnswer.trim()) return null;
      return {
        id: uid(),
        question: d.question.trim(),
        type: "text",
        modelAnswer: d.modelAnswer.trim(),
        note: d.note.trim() || undefined,
        hashtags: tags,
        createdAt: Date.now(),
      };
    }
  };

  const canPostSingle = useMemo(
    () =>
      !!toQuizPost({
        type,
        question,
        note,
        tagsInput,
        correctChoice,
        wrongChoices,
        modelAnswer,
      }),
    [type, question, note, tagsInput, correctChoice, wrongChoices, modelAnswer]
  );

  // 複数用の Post 化関数（共通タグを使う）
  const toQuizPostWithSharedTags = (
    d: Draft,
    tagsText: string
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
      };
    }
  };

  // const canPostMulti = useMemo(() => {
  //   if (!multi) return false;
  //   if (drafts.length === 0 || drafts.length > 10) return false;
  //   const posts = drafts.map(toQuizPost).filter(Boolean) as QuizPost[];
  //   return posts.length === drafts.length; // 全部OK
  // }, [multi, drafts]);
  // canPostMulti の定義を置き換え
  const canPostMulti = useMemo(() => {
    if (!multi) return false;
    if (drafts.length === 0 || drafts.length > 10) return false;
    const tags = parseHashtags(sharedTags); // 共通タグ必須
    if (tags.length === 0) return false;

    const posts = drafts
      .map((d) => toQuizPostWithSharedTags(d, sharedTags))
      .filter(Boolean) as QuizPost[];
    return posts.length === drafts.length;
  }, [multi, drafts, sharedTags]);

  const submitSingle = () => {
    const p = toQuizPost({
      type,
      question,
      note,
      tagsInput,
      correctChoice,
      wrongChoices,
      modelAnswer,
    });
    if (!p) return;
    onPost(p);
    onCancel();
  };

  // const submitMulti = () => {
  //   if (!onPostBundle) return;
  //   const posts = drafts.map(toQuizPost).filter(Boolean) as QuizPost[];
  //   if (posts.length === 0 || posts.length > 10) return;
  //   onPostBundle(posts);
  //   onCancel();
  // };
  // submitMulti も置き換え
  const submitMulti = () => {
    if (!onPostBundle) return;
    const posts = drafts
      .map((d) => toQuizPostWithSharedTags(d, sharedTags))
      .filter(Boolean) as QuizPost[];
    if (posts.length === 0 || posts.length > 10) return;
    onPostBundle(posts);
    onCancel();
  };

  // UI
  return (
    <div>
      {/* モード切替 */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">投稿モード</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMulti(false)}
            className={`px-2 py-1 rounded-full border ${
              !multi ? "bg-black text-white border-black" : "border-gray-300"
            }`}
          >
            単問
          </button>
          <button
            onClick={() => setMulti(true)}
            className={`px-2 py-1 rounded-full border ${
              multi ? "bg-black text-white border-black" : "border-gray-300"
            }`}
          >
            まとめて（最大10）
          </button>
        </div>
      </div>

      {!multi ? (
        /* ==== 単問（従来 + 正解/不正解分離） ==== */
        <SingleEditor
          type={type}
          setType={setType}
          question={question}
          setQuestion={setQuestion}
          note={note}
          setNote={setNote}
          tagsInput={tagsInput}
          setTagsInput={setTagsInput}
          correctChoice={correctChoice}
          setCorrectChoice={setCorrectChoice}
          wrongChoices={wrongChoices}
          setWrongChoices={setWrongChoices}
          modelAnswer={modelAnswer}
          setModelAnswer={setModelAnswer}
        />
      ) : (
        /* ==== 複数（最大10件） ==== */
        <div className="space-y-4">
          {/* 共通タグ入力（全問題に適用） */}
          <div className="mb-2">
            <div className="text-xs font-bold mb-1">
              共通タグ（全問題に適用）
            </div>
            <input
              value={sharedTags}
              onChange={(e) => setSharedTags(e.target.value)}
              placeholder="#英単語 #歴史 など（カンマ・空白で区切り）"
              className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
            />
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
              setDrafts((prev) =>
                prev.map((x, i) => (i === activeIdx ? nd : x))
              )
            }
            onRemove={() => {
              setDrafts((prev) => {
                const next = prev.filter((_, i) => i !== activeIdx);
                const nextIdx = Math.max(
                  0,
                  Math.min(activeIdx, next.length - 1)
                );
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
      )}

      {/* ボタン */}
      <div className="flex gap-2 justify-end pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-full font-bold bg-gray-100"
        >
          キャンセル
        </button>
        {!multi ? (
          <button
            disabled={!canPostSingle}
            onClick={submitSingle}
            className={`px-4 py-2 rounded-full font-bold ${
              canPostSingle
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            投稿
          </button>
        ) : (
          <button
            disabled={!canPostMulti}
            onClick={submitMulti}
            className={`px-4 py-2 rounded-full font-bold ${
              canPostMulti ? "bg-black text-white" : "bg-gray-200 text-gray-400"
            }`}
          >
            まとめて投稿（{drafts.length}問）
          </button>
        )}
      </div>
    </div>
  );
};

// 単問エディタ（正解/不正解分離UI）——前回提案の入力UIを小分け化
const SingleEditor: React.FC<{
  type: QuizType;
  setType: (v: QuizType) => void;
  question: string;
  setQuestion: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  tagsInput: string;
  setTagsInput: (v: string) => void;
  correctChoice: string;
  setCorrectChoice: (v: string) => void;
  wrongChoices: string[];
  // setWrongChoices: (v: string[]) => void;
  setWrongChoices: React.Dispatch<React.SetStateAction<string[]>>;
  modelAnswer: string;
  setModelAnswer: (v: string) => void;
}> = (props) => {
  const {
    type,
    setType,
    question,
    setQuestion,
    note,
    setNote,
    tagsInput,
    setTagsInput,
    correctChoice,
    setCorrectChoice,
    wrongChoices,
    setWrongChoices,
    modelAnswer,
    setModelAnswer,
  } = props;

  // const addWrong = () => setWrongChoices((prev) => [...prev, ""]);
  // const updateWrong = (i: number, val: string) =>
  //   setWrongChoices((prev) => prev.map((x, idx) => (idx === i ? val : x)));
  // const removeWrong = (i: number) =>
  //   setWrongChoices((prev) => prev.filter((_, idx) => idx !== i));
  // noImplicitAny でも安心なように引数に型を明示
  const addWrong = () =>
    setWrongChoices((prev: string[]) => [...prev, ""]);
  const updateWrong = (i: number, val: string) =>
    setWrongChoices((prev: string[]) =>
      prev.map((x: string, idx: number) => (idx === i ? val : x))
    );
  const removeWrong = (i: number) =>
    setWrongChoices((prev: string[]) =>
      prev.filter((_: string, idx: number) => idx !== i)
    );
  return (
    <div>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="w-full resize-none outline-none placeholder:text-gray-400 text-[16px] min-h-[64px]"
        placeholder="いま何を出題する？（問題文）"
      />

      <div className="flex gap-2 text-sm mb-3 mt-2">
        <button
          className={`px-2 py-1 rounded-full border ${
            type === "choice"
              ? "bg-black text-white border-black"
              : "border-gray-300"
          }`}
          onClick={() => setType("choice")}
        >
          選択肢
        </button>
        <button
          className={`px-2 py-1 rounded-full border ${
            type === "text"
              ? "bg-black text-white border-black"
              : "border-gray-300"
          }`}
          onClick={() => setType("text")}
        >
          テキスト入力
        </button>
      </div>

      {type === "choice" ? (
        <div className="mb-3 space-y-3">
          <div>
            <div className="text-xs font-bold text-green-700 mb-1">正解</div>
            <input
              value={correctChoice}
              onChange={(e) => setCorrectChoice(e.target.value)}
              placeholder="正解の選択肢"
              className="w-full px-3 py-2 bg-green-50 rounded-xl border border-green-200"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-700 mb-1">
              不正解（複数可）
            </div>
            {wrongChoices.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  value={c}
                  onChange={(e) => updateWrong(i, e.target.value)}
                  placeholder={`不正解 ${i + 1}`}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
                />
                {wrongChoices.length > 1 && (
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
            value={modelAnswer}
            onChange={(e) => setModelAnswer(e.target.value)}
            placeholder="模範解答（採点の目安）"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
          />
        </div>
      )}

      <div className="mb-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="補足（任意）"
          className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
        />
      </div>
      <div className="mb-2">
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="#タグ（カンマ・空白で区切り）"
          className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
        />
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
      {/* <div className="mb-2">
        <input
          value={draft.tagsInput}
          onChange={(e) => set({ tagsInput: e.target.value })}
          placeholder="#タグ（カンマ・空白で区切り）"
          className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
        />
      </div> */}
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
      <SectionTitle title="クイズフォルダ（ハッシュタグ）" />
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
              開始
            </button>
            <button
              onClick={() => onShare(tag)}
              className="px-3 py-1 rounded-full text-sm border"
            >
              共有
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
// const ActionBar: React.FC<{
//   likes: number;
//   retweets: number;
//   onLike: () => void;
//   onRT: () => void;
// }> = ({ likes, retweets, onLike, onRT }) => (
//   <div className="flex items-center gap-6 text-sm text-gray-600 pt-2">
//     <button onClick={onRT} className="flex items-center gap-1">
//       🔁 <span>{retweets}</span>
//     </button>
//     <button onClick={onLike} className="flex items-center gap-1">
//       ⭐ <span>{likes}</span>
//     </button>
//   </div>
// );
// 置き換え
const ActionBar: React.FC<{
  likes: number;
  retweets: number;
  answers?: number;
  onLike: () => void;
  onRT: () => void;
  onAnswer?: () => void; // 追加
}> = ({ likes, retweets, answers, onLike, onRT, onAnswer }) => (
  <div className="flex items-center gap-6 text-sm text-gray-600 pt-2">
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
);

/* =========================
   メインアプリ
========================= */
export default function QuizApp() {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  // const [mode, setMode] = useState<
  //   "home" | "folders" | "quiz" | "search" | "notifications"
  // >("home");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const [mode, setMode] = useState<
    "home" | "folders" | "quiz" | "search" | "notifications" | "answer"
  >("home");
  const [answerPool, setAnswerPool] = useState<QuizPost[] | null>(null);

  // 共有モーダル
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTag, setShareTag] = useState<string>("");
  const [shareMessage, setShareMessage] = useState<string>("");

  // 初期化：カテゴリJSONを未投入分だけ追加し、既存の保存データとマージ
  useEffect(() => {
    const storedPosts = loadPosts();
    const storedFeed = loadFeed();

    const { posts: catPosts, newlySeededKeys } = loadCategorySeedsAsPosts();

    const mergedPosts = [...catPosts, ...storedPosts];
    setPosts(mergedPosts);
    savePosts(mergedPosts);

    const catFeed: FeedItem[] = catPosts.map((post) => ({
      id: post.id,
      kind: "quiz",
      data: post,
      createdAt: post.createdAt,
      likes: 0,
      retweets: 0,
      answers: 0,
    }));
    const mergedFeed = [...catFeed, ...storedFeed];
    setFeed(mergedFeed);
    saveFeed(mergedFeed);

    if (newlySeededKeys.length > 0) {
      const prev = loadSeededCats();
      const next = Array.from(new Set([...prev, ...newlySeededKeys]));
      saveSeededCats(next);
    }
  }, []);

  useEffect(() => savePosts(posts), [posts]);
  useEffect(() => saveFeed(feed), [feed]);

  const addPost = (post: QuizPost) => {
    setPosts((prev) => [post, ...prev]);
    setFeed((prev) => [
      {
        id: post.id,
        kind: "quiz",
        data: post,
        createdAt: post.createdAt,
        likes: 0,
        retweets: 0,
        answers: 0,
      },
      ...prev,
    ]);
  };

  const startQuiz = (tag: string) => {
    setSelectedTag(tag);
    setMode("quiz");
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
  };

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
  };

  const incLike = (id: string) =>
    setFeed((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, likes: (it as any).likes + 1 } : it
      )
    );
  const incRT = (id: string) =>
    setFeed((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, retweets: (it as any).retweets + 1 } : it
      )
    );
  const incAnswer = (id: string) =>
  setFeed((prev) =>
    prev.map((it) =>
      // quiz / quizBundle のときだけ加算、share は対象外
      (it.kind === "quiz" || it.kind === "quizBundle") && it.id === id
        ? { ...it, answers: (it as any).answers + 1 }
        : it
    )
  );


  const activeTab = mode;

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 pb-16">
      <Header />

      <div className="max-w-md mx-auto">
        {/* HOME */}
        {mode === "home" && (
          <Card>
            <SectionTitle title="ホーム" />
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
                        {item.data.type === "choice"
                          ? "選択肢"
                          : "テキスト入力"}
                      </div>
                      <ActionBar
                        likes={item.likes}
                        retweets={item.retweets}
                        answers={item.answers} 
                        onLike={() => incLike(item.id)}
                        onRT={() => incRT(item.id)}
                        onAnswer={() => {
                          incAnswer(item.id);
                          setAnswerPool([item.data]); // ← この投稿だけをプールに
                          setMode("answer");
                        }}
                      />
                    </>
                  ) : item.kind === "quizBundle" ? (
                    <>
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
                          setAnswerPool(item.data); // ← バンドル全体をプールに
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

        <div className="h-4" />
      </div>

      {/* 投稿モーダル */}
      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="投稿"
      >
        <Composer
          onPost={addPost} // 単問
          onPostBundle={addPostBundle} // 複数
          onCancel={() => setComposerOpen(false)}
        />
      </Modal>

      {/* 共有メッセージ編集モーダル */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="共有">
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

      {/* ボトムナビ */}
      <BottomNav
        active={activeTab}
        onHome={() => setMode("home")}
        onSearch={() => setMode("search")}
        onFolders={() => setMode("folders")}
        onNotify={() => setMode("notifications")}
        onPost={() => setComposerOpen(true)}
      />
    </div>
  );
}
