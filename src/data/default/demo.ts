// src/data/default/demo.ts
// ここは純粋な“種データ”だけを持たせます（id/createdAt は未付与）

export type QuizSeed = {
  question: string;
  type: "choice" | "text";
  // 選択式
  choices?: string[];
  correctIndex?: number;
  // テキスト式
  modelAnswer?: string;
  // 共通
  note?: string;
  hashtags: string[];
};

export const DEFAULT_QUIZ_SEEDS: QuizSeed[] = [
  {
    question: "日本の首都は？",
    type: "choice",
    choices: ["大阪", "東京", "名古屋"],
    correctIndex: 1,
    hashtags: ["#一般常識", "#地理"],
  },
  {
    question: "HTTP の既定ポート番号は？",
    type: "choice",
    choices: ["21", "25", "80", "443"],
    correctIndex: 2,
    hashtags: ["#IT基礎"],
  },
  {
    question: "関数の引数に渡した値をそのまま返す関数を何という？",
    type: "text",
    modelAnswer: "恒等関数",
    hashtags: ["#数学", "#プログラミング"],
  },
  {
    question: "ユビキタス言語を用いる開発手法は？",
    type: "text",
    modelAnswer: "ドメイン駆動設計",
    hashtags: ["#DDD", "#設計"],
  },
  {
    question: "次のうち、原色(RGB)に含まれないのは？",
    type: "choice",
    choices: ["赤", "緑", "青", "黄"],
    correctIndex: 3,
    hashtags: ["#デザイン基礎"],
  },
];
