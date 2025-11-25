// resources/js/components/discussion/DiscussionComposer.tsx
import React, { useState } from "react";
import { Modal } from "../layout/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; agenda: string; tags: string[] }) => Promise<void> | void;
};

const DiscussionComposer: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleSubmit = async () => {
    const tags = tagsInput
      .split(/[、,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    await onSubmit({ title, agenda, tags });
    setTitle("");
    setAgenda("");
    setTagsInput("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="議題を投稿">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-700">タイトル</label>
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-700">アジェンダ</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm min-h-[120px]"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-700">タグ（スペース/カンマ区切り）</label>
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#教育 #ICT など"
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
            disabled={!title.trim()}
          >
            投稿
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DiscussionComposer;
