// resources/js/components/home/ShareDialog.tsx
import React from "react";
import { Modal } from "../layout/Modal";

type Props = {
  open: boolean;
  tag: string;
  message: string;
  onChangeMessage: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ShareDialog: React.FC<Props> = ({
  open,
  tag,
  message,
  onChangeMessage,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          {tag} のフォルダを共有します。メッセージを編集できます。
        </div>
        <textarea
          value={message}
          onChange={(e) => onChangeMessage(e.target.value)}
          className="w-full h-28 p-3 border rounded-xl"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full bg-black text-white font-bold"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};
