// resources/js/components/ui/Card.tsx
import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div
    className={`w-full bg-[#FAF9F6] border-b border-gray-200 ${className ?? ""}`}
  >
    {children}
  </div>
);
