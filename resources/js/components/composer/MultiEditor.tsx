// resources/js/components/composer/MultiEditor.tsx
import React from "react";
import type { QuizType } from "../../types/quiz";

export type Draft = {
  id?: string;
  type: QuizType;
  question: string;
  note: string;
  tagsInput: string;
  correctChoice: string;
  wrongChoices: string[];
  modelAnswer: string;
};

type MultiEditorProps = {
  index: number;
  draft: Draft;
  onChange: (d: Draft) => void;
  onRemove: () => void;
  removable: boolean;
};

export const MultiEditor: React.FC<MultiEditorProps> = ({
  index,
  draft,
  onChange,
  onRemove,
  removable,
}) => {
  const set = (patch: Partial<Draft>) =>
    onChange({ ...draft, ...patch });

  const updateWrong = (i: number, val: string) =>
    set({
      wrongChoices: draft.wrongChoices.map((x, idx) =>
        idx === i ? val : x
      ),
    });

  const addWrong = () =>
    set({ wrongChoices: [...draft.wrongChoices, ""] });

  const removeWrong = (i: number) =>
    set({
      wrongChoices: draft.wrongChoices.filter((_, idx) => idx !== i),
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
            {draft.wrongChoices.map((c, i) => (
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
