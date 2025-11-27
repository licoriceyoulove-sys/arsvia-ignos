// src/types/quiz.ts

export type QuizType = "choice" | "text";
export type Visibility = 1 | 2 | 3; // 1:プライベート, 2:フォロワー限定, 3:グローバル

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
    author_id?: number;
    visibility: Visibility;

    category_tag?: string | null;

    authorDisplayName?: string;
    authorIgnosId?: string | null;

    bundleId?: string | null;
    bundleOrder?: number;
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
    isMarked?: boolean;
    answers: number;
};

export type FeedQuizItem = {
    id: string;
    kind: "quiz";
    data: QuizPost;
    createdAt: number;
    likes: number;
    retweets: number;
    answers: number;
    isMarked?: boolean;
};

export type FeedQuizBundleItem = {
    id: string;
    kind: "quizBundle";
    data: QuizPost[]; // まとめて投稿された問題群
    createdAt: number;
    likes: number;
    retweets: number;
    answers: number;
    isMarked?: boolean;
};

// export type FeedItem = FeedQuizItem | FeedQuizBundleItem | SharePost;
export type FeedItem = {
  id: string;
  kind: "quiz" | "quizBundle" | "share";
  data: any;
  createdAt: number;
  likes: number;
  retweets: number;
  answers: number;
  isMarked?: boolean;
};
