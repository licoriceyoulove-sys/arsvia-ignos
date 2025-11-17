// resources/js/components/ui/TagChip.tsx
import React from "react";

type TagChipProps = {
  tag: string;
  onClick?: () => void;
  active?: boolean;
};

export const TagChip: React.FC<TagChipProps> = ({ tag, onClick, active }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-sm mr-2 mb-2 border ${
      active
        ? "bg-black text-white border-black"
        : "bg-gray-50 text-gray-700 border-gray-200"
    }`}
  >
    {tag}
  </button>
);
