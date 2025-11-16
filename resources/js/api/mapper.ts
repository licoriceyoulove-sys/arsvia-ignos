import type { QuizPost, FeedItem } from "../QuizApp";

// APIの行 → 既存のQuizPostへ
export const fromQuizRow = (r: {
  id: string; question: string; type: "choice"|"text";
  choices?: string[] | null; correct_index?: number | null;
  model_answer?: string | null; note?: string | null;
  hashtags: string[]; created_at: string;
}) => ({
  id: r.id,
  question: r.question,
  type: r.type,
  choices: r.choices ?? undefined,
  correctIndex: typeof r.correct_index === "number" ? r.correct_index : undefined,
  modelAnswer: r.model_answer ?? undefined,
  note: r.note ?? undefined,
  hashtags: r.hashtags,
  createdAt: new Date(r.created_at).getTime(),
});


// QuizPost → API行
export const toQuizRow = (p: QuizPost) => ({
  id: p.id,
  question: p.question,
  type: p.type,
  choices: p.choices ?? null,
  correct_index: p.correctIndex ?? null,
  model_answer: p.modelAnswer ?? null,
  note: p.note ?? null,
  hashtags: p.hashtags,
  created_at: new Date(p.createdAt).toISOString(),
  author_id: p.author_id ?? null,
});

// FeedItem → API行（dataはそのままJSONで送る）
export const toFeedRow = (f: FeedItem) => ({
  id: (f as any).id,
  kind: (f as any).kind,               // 'quiz' | 'quizBundle' | 'share'
  data: (f as any).kind === "share"
    ? { tag: (f as any).tag, message: (f as any).message }
    : (f as any).data,
  likes: (f as any).likes ?? 0,
  retweets: (f as any).retweets ?? 0,
  answers: (f as any).answers ?? 0,
  created_at: new Date((f as any).createdAt).toISOString(),
  author_id: (f as any).author_id ?? null,
});
