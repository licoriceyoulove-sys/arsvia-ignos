import React, { useState } from "react";
import type { QuizPost, QuizType, Visibility } from "../../types/quiz";
import { CURRENT_USER_ID } from "../../utils/user";

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

type BulkInputItem = {
  question: string;
  type?: "choice" | "text";        // 省略時は "choice"
  choices?: string[];              // choice のとき。省略時は自動組み立て
  correct?: string;                // 正解（必須）
  wrongs?: string[];               // 不正解の配列（1つ以上推奨）
  modelAnswer?: string;            // テキスト問題用の模範解答
  note?: string;                   // 解説・補足
};

type Props = {
  onClose: () => void;
  onImported: (posts: QuizPost[]) => void;
};

export const BulkImportDialog: React.FC<Props> = ({
  onClose,
  onImported,
}) => {
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
    } catch {
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
        const wrongs = (item.wrongs ?? [])
          .map((w) => String(w).trim())
          .filter(Boolean);
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
        {/* AI向けプロンプト */}
        <div>
          <div className="text-xs font-bold mb-1">AI向けプロンプト（コピーして使えます）</div>
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
- 選択肢は理解力を高める目的で、間違えやすいものにしてください。過去問などがあればそれを優先して参照してください。

【1問の形式】
{
  "question": "問題文",
  "type": "choice" または "text",
  "correct": "正解",
  "wrongs": ["不正解1", "不正解2", "不正解3"],
  "note": "解説（中学生でも理解できるレベルで、不正解の選択肢に対しても解説を行ってください。）"
}

【生成してほしい内容】
（ここに分野を書く）

【最終出力】
JSON 配列のみを出力`}
            className="w-full h-40 p-3 border rounded-xl bg-gray-50 text-xs font-mono"
          />
        </div>

        {/* タグ */}
        <div>
          <div className="text-xs font-bold mb-1">タグ（全問題共通）</div>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#英単語 #歴史 など（空白・カンマ区切り）"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200"
          />
        </div>

        {/* 公開範囲 */}
        <div>
          <div className="text-xs font-bold mb-1">公開範囲（全問題共通）</div>
          <div className="flex gap-2 text-xs">
            {[1, 2, 3].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v as Visibility)}
                className={`px-3 py-1 rounded-full border ${
                  visibility === v
                    ? "bg-black text-white border-black"
                    : "bg-gray-50 text-gray-700 border-gray-300"
                }`}
              >
                {v === 1 ? "プライベート" : v === 2 ? "フォロワー限定" : "グローバル"}
              </button>
            ))}
          </div>
        </div>

        {/* JSON */}
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
    "note": "apple は「りんご」。"
  }
]`}
            className="w-full h-48 p-3 border rounded-xl bg-gray-50 border-gray-200 font-mono text-xs"
          />
        </div>

        {error && <div className="text-xs text-red-600 whitespace-pre-wrap">{error}</div>}

        {preview && (
          <div className="text-xs text-gray-600">プレビュー件数: {preview.length} 件</div>
        )}
      </div>

      {/* ボタン */}
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
