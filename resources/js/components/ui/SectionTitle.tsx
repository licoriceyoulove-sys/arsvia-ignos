// resources/js/components/ui/SectionTitle.tsx
import React from "react";

type SectionTitleProps = {
  title: string;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({ title }) => (
  <div className="px-4 py-2 font-bold text-gray-900 text-lg">{title}</div>
);
