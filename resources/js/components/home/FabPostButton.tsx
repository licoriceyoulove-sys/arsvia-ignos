// resources/js/components/home/FabPostButton.tsx
import React from "react";

type Props = {
  onClick: () => void;
};

const iconUrl = (name: string) => `./build/icons/${name}.png`;

export const FabPostButton: React.FC<Props> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="
      fixed
      bottom-20 right-4
      z-20
      w-14 h-14
      rounded-full
      bg-black
      text-white
      shadow-lg
      flex items-center justify-center
    "
    aria-label="投稿"
  >
    <img src={iconUrl("post")} alt="投稿" className="w-7 h-7" />
  </button>
);
