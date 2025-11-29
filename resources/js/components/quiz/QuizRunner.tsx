// resources/js/components/quiz/QuizRunner.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { QuizPost } from "../../types/quiz";
import { CURRENT_USER_ID, pickDisplayName, getCurrentUserIgnosId } from "../../utils/user";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";

/* =========================
   型・共通ユーティリティ
========================= */

export type PreparedQuestion = {
  post: QuizPost;
  idx: number;
  // 出題用にシャッフルした選択肢 & 表示上の正解インデックス
  displayChoices?: string[];
  answerIndex?: number;
};

export type QuizStage = "answering" | "revealed" | "finished";

// 選択肢シャッフル（Fisher–Yates）
export const shuffleChoicesWithAnswer = (choices: string[], correctIndex: number) => {
  const idx = choices.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const displayChoices = idx.map((i) => choices[i]);
  const answerIndex = idx.indexOf(correctIndex);
  return { displayChoices, answerIndex };
};

// ランダム10問準備（choice はこの時点でシャッフル）
export const pickRandom10 = (pool: QuizPost[]): PreparedQuestion[] => {
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

/* =========================
   投稿配列専用ランナー（AnswerRunner）
========================= */

export type AnswerRunnerProps = {
  posts: QuizPost[]; // その投稿に含まれる問題（1件～最大10件）
  title?: string;
  onBack: () => void;
  followIds: number[];                          // フォロー中ユーザーID一覧
  onToggleFollow: (targetUserId: number) => void; // フォロー/解除をトグル
};

export const AnswerRunner: React.FC<AnswerRunnerProps> = ({
  posts,
  title = "この投稿に回答",
  onBack,
  followIds,
  onToggleFollow,
}) => {
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

            {/* ▼ 出題者情報＋フォローボタン */}
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
   タグからランダム10問（QuizRunner）
========================= */

export type QuizRunnerProps = {
  tag: string;
  posts: QuizPost[];
  onBack: () => void;
  followIds: number[];
  onToggleFollow: (targetUserId: number) => void;
};

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  tag,
  posts,
  onBack,
  followIds,
  onToggleFollow,
}) => {
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

            {/* ▼ 出題者情報＋フォローボタン */}
            {authorId && (
              <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-300" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{displayName}</span>
                    <span className="text-xs text-gray-500">@{ignosId}</span>
                  </div>
                </div>

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
