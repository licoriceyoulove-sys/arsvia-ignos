// resources/js/components/discussion/DiscussionList.tsx
import React from "react";
import type { DiscussionSummary } from "../../types/discussion";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";

type Props = {
  keyword: string;
  discussions: DiscussionSummary[];
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
  onSelectDiscussion: (id: number) => void;
  onOpenComposer: () => void;
};

const DiscussionList: React.FC<Props> = ({
  keyword,
  discussions,
  onKeywordChange,
  onSearch,
  onSelectDiscussion,
  onOpenComposer,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 pb-16">
      <SectionTitle title="議論" />

      {/* 検索フォーム */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="議題・アジェンダ・タグで検索"
        />
        <button
          className="px-3 py-1 rounded bg-blue-500 text-white text-sm"
          onClick={onSearch}
        >
          検索
        </button>
      </div>

      {/* 一覧 */}
      <div className="flex flex-col gap-2 mt-2">
{discussions.map((d) => (
  <div
    key={d.id}
    className="cursor-pointer"
    onClick={() => onSelectDiscussion(d.id)}
  >
    <Card>
      <div className="font-semibold text-sm mb-1">{d.title}</div>
      <div className="text-xs text-gray-600 line-clamp-2 mb-1">
        {d.agenda}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {d.tags.map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
          >
            {t}
          </span>
        ))}
      </div>
    </Card>
  </div>
))}

        {discussions.length === 0 && (
          <div className="text-xs text-gray-500 mt-4">
            議論がまだありません。右下のボタンから議題を投稿しましょう。
          </div>
        )}
      </div>

      {/* 右下フローティングボタンは QuizApp 側で制御するのでここでは触らない */}
    </div>
  );
};

export default DiscussionList;
