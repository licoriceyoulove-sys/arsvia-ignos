// resources/js/components/composer/Composer.tsx
import React, { useMemo, useState } from "react";
import type { QuizType, Visibility, QuizPost } from "../../types/quiz";
import { CURRENT_USER_ID } from "../../utils/user";
import { MultiEditor, type Draft } from "./MultiEditor";

// ランダムID
const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// #タグ入力を配列化（#, 空白/カンマ/改行区切り）
const parseHashtags = (input: string): string[] =>
  (input ?? "")
    .split(/[\s,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));

type ComposerProps = {
  onCancel: () => void;
  onPostBundle?: (posts: QuizPost[]) => void; // 新規まとめ投稿
  onEditBundle?: (payload: {
    posts: QuizPost[];
    deletedIds: string[];
  }) => void; // 編集時
  mode?: "create" | "edit";
  initialPosts?: QuizPost[] | null; // 編集対象（0 or 複数）
};

export const Composer: React.FC<ComposerProps> = ({
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
          type: "choice" as QuizType,
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
          type: "text" as QuizType,
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
  return (
    // モーダル全体を上下レイアウトにする
    <div className="flex flex-col h-full">
      {/* 上部ヘッダー（固定表示） */}
      <div className="flex items-center justify-between px-4 h-12 border-b flex-none">
        <button onClick={onCancel} className="text-sm text-gray-600">
          キャンセル
        </button>

        {/* 真ん中のタイトル：モードで出し分け */}
        <div className="text-sm font-bold">
          {mode === "edit" ? "投稿を編集" : ""}
        </div>

        <button
          disabled={!canPostMulti}
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
