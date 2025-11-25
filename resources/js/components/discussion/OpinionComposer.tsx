// resources/js/components/discussion/OpinionComposer.tsx
import React, { useState } from "react";
import { Modal } from "../layout/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { body: string; choices: string[] }) => Promise<void> | void;
};

const OpinionComposer: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<string[]>(["", ""]);

  const updateChoice = (index: number, value: string) => {
    setChoices((prev) => {
      const newChoices = [...prev];
      newChoices[index] = value;
      return newChoices;
    });
  };

  const addChoice = () => setChoices((prev) => [...prev, ""]);
  const removeChoice = (index: number) =>
    setChoices((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const filtered = choices.map((c) => c.trim()).filter(Boolean);
    if (filtered.length < 2) return; // 最低2つ
    await onSubmit({ body, choices: filtered });
    setBody("");
    setChoices(["", ""]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="意見を投稿">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-700">意見</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm min-h-[120px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700">選択肢</label>
          {choices.map((c, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={c}
                onChange={(e) => updateChoice(i, e.target.value)}
              />
              {choices.length > 2 && (
                <button
                  className="text-xs text-red-500"
                  onClick={() => removeChoice(i)}
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button
            className="self-start text-xs text-blue-500 mt-1"
            onClick={addChoice}
          >
            ＋選択肢を追加
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            className="px-3 py-1 text-xs text-gray-600"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="px-3 py-1 text-xs rounded bg-blue-500 text-white"
            onClick={handleSubmit}
          >
            投稿
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OpinionComposer;
