// resources/js/components/layout/Modal.tsx
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // 既存コードが title を渡しているので、型だけ受け取って無視しておく
  title?: string;
};

export const Modal: React.FC<Props> = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* 背景（タップで閉じる） */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* フルスクリーンのモーダル本体 */}
      <div
        className="
          absolute inset-0
          max-w-md mx-auto
          bg-white
          flex flex-col
        "
      >
        {children}
      </div>
    </div>
  );
};
