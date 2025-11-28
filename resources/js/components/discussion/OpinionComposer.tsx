// resources/js/components/discussion/OpinionComposer.tsx
import React, { useState } from "react";
import { Modal } from "../layout/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  // ★ 意見本文だけ送る形に変更
  onSubmit: (payload: { body: string }) => Promise<void> | void;
};

const OpinionComposer: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [body, setBody] = useState("");

  const handleSubmit = async () => {
    const trimmed = body.trim();

    // 入力チェック：空なら何もしない
    if (!trimmed) {
      alert("意見を入力してください。");
      return;
    }

    // 投稿前の確認ダイアログ
    const ok = window.confirm("現在の内容で投稿します。よろしいですか？");
    if (!ok) return;

    // 親コンポーネントへ送信
    await onSubmit({ body: trimmed });

    // フォームクリア
    setBody("");
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
              placeholder={`あなたの意見を書いてください。
過激な表現や個人を特定できるような情報は含めないようご注意ください。
投稿する前に誤字・脱字がないか、誤解を与えるような文章になっていないか確認しましょう。`
  }
          />
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
