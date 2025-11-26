// resources/js/components/ui/VisibilityIcon.tsx
import React from "react";
import type { Visibility } from "../../types/quiz";

const ICON_SRC: Record<Visibility, string> = {
  1: `/ignos/public/build/icons/visibility-private.png`,   // 自分のみ
  2: `/ignos/public/build/icons/visibility-followers.png`, // フォロワー限定
  3: `/ignos/public/build/icons/visibility-global.png`,    // グローバル
};

type Props = {
  value?: Visibility | null;
  size?: "sm" | "md";
};

export const VisibilityIcon: React.FC<Props> = ({ value, size = "md" }) => {
  if (!value) return null;

  const src = ICON_SRC[value as Visibility];
  if (!src) return null;

  const title =
    value === 1 ? "自分のみ" : value === 2 ? "フォロワー限定" : "グローバル";

  const imgSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <img
      src={src}
      alt={title}
      title={title}
      className={`${imgSize} object-contain`}
    />
  );
};
