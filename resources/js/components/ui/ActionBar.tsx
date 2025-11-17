// resources/js/components/ui/ActionBar.tsx
import React from "react";

type ActionBarProps = {
  likes: number;
  retweets: number;
  answers?: number;
  onLike: () => void;
  onRT: () => void;
  onAnswer?: () => void;
};

export const ActionBar: React.FC<ActionBarProps> = ({
  likes,
  retweets,
  answers,
  onLike,
  onRT,
  onAnswer,
}) => (
  <div className="flex items-center gap-6 text-sm text-gray-600 pt-2">
    <button onClick={onRT} className="flex items-center gap-1">
      🔁 <span>{retweets}</span>
    </button>
    <button onClick={onLike} className="flex items-center gap-1">
      ⭐ <span>{likes}</span>
    </button>
    {onAnswer && (
      <button onClick={onAnswer} className="flex items-center gap-1">
        🅰 <span>{typeof answers === "number" ? answers : ""}</span>
      </button>
    )}
  </div>
);
