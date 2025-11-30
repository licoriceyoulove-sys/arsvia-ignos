// resources/js/components/quiz/VisibilityModal.tsx
import React from "react";
import type { Visibility } from "../../types/quiz";
import { Modal } from "../layout/Modal";
import { VisibilityIcon } from "../ui/VisibilityIcon";

type Props = {
  open: boolean;
  current?: Visibility | null;
  isUpdating: boolean;
  onChange: (v: Visibility) => void;
  onClose: () => void;
};

export const VisibilityModal: React.FC<Props> = ({
  open,
  current,
  isUpdating,
  onChange,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <div
        className="
          w-full max-w-xs mx-auto
          mt-24 mb-8
          p-4
          bg-white rounded-2xl shadow-lg border border-gray-200
          space-y-4
        "
      >
        <h2 className="text-base font-semibold">公開範囲の変更</h2>

        <div className="space-y-2">
          {[
            {
              value: 1 as Visibility,
              label: "プライベート",
              desc: "あなたのみ見ることができます",
            },
            {
              value: 2 as Visibility,
              label: "フォロワー限定",
              desc: "フォロワーに公開",
            },
            {
              value: 3 as Visibility,
              label: "グローバル",
              desc: "全てのユーザーに公開",
            },
          ].map((opt) => {
            const isSelected = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isUpdating}
                onClick={() => onChange(opt.value)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded border text-left text-sm
                  ${isSelected ? "bg-gray-100 border-gray-400" : "border-gray-200"}
                `}
              >
                <span className="flex-shrink-0">
                  <VisibilityIcon value={opt.value} size="sm" />
                </span>
                <span className="flex-1">
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[11px] text-gray-500">
                    {opt.desc}
                  </div>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-1 w-full text-xs text-gray-500 underline"
          onClick={onClose}
          disabled={isUpdating}
        >
          キャンセル
        </button>
      </div>
    </Modal>
  );
};
