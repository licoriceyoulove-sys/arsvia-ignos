// resources/js/components/layout/Header.tsx
import React from "react";

export const Header: React.FC = () => (
  <div className="sticky top-0 bg-white/90 backdrop-blur z-20 border-b border-gray-200">
    <div className="max-w-md mx-auto flex items-center justify-between px-4 h-12">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white font-bold">
          I
        </div>
        <div className="font-bold">Ignos</div>
      </div>
      <div className="w-8" />
    </div>
  </div>
);
