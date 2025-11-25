// resources/js/components/discussion/DiscussionDetail.tsx
import React from "react";
import type { DiscussionDetail, DiscussionOpinion } from "../../types/discussion";
import { Card } from "../ui/Card";

type Props = {
  detail: DiscussionDetail;
  onBack: () => void;
  onOpenOpinionComposer: () => void;
  onVote: (opinionId: number, choiceId: number) => void;
};

const calcPercent = (voteCount: number, total: number) =>
  total > 0 ? Math.round((voteCount / total) * 100) : 0;

const DiscussionDetailView: React.FC<Props> = ({
  detail,
  onBack,
  onOpenOpinionComposer,
  onVote,
}) => {
  return (
    <div className="flex flex-col h-full pb-16">
      {/* ヘッダーエリア */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            className="text-sm text-blue-500"
            onClick={onBack}
          >
            ← 戻る
          </button>
          <div className="font-semibold text-sm truncate">
            {detail.title}
          </div>
        </div>
        <div className="px-3 pb-2 text-xs text-gray-700">
          {detail.agenda}
        </div>
        <div className="px-3 pb-2 flex flex-wrap gap-1 text-xs">
          {detail.tags.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 意見一覧 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {detail.opinions.map((opinion) => (
          <OpinionCard
            key={opinion.id}
            opinion={opinion}
            onVote={(choiceId) => onVote(opinion.id, choiceId)}
          />
        ))}

        {detail.opinions.length === 0 && (
          <div className="text-xs text-gray-500 mt-4">
            まだ意見がありません。右下のボタンから意見を投稿しましょう。
          </div>
        )}
      </div>

      {/* 右下ボタンは QuizApp 側で「意見投稿」ボタンに切り替える */}
    </div>
  );
};

type OpinionCardProps = {
  opinion: DiscussionOpinion;
  onVote: (choiceId: number) => void;
};

const OpinionCard: React.FC<OpinionCardProps> = ({ opinion, onVote }) => {
  const hasVoted = opinion.myChoiceId != null;

  return (
    <Card className="flex flex-col gap-2">
      <div className="text-sm whitespace-pre-wrap">{opinion.body}</div>

      <div className="flex flex-col gap-1">
        {opinion.choices.map((c) => {
          const percent = calcPercent(c.voteCount, opinion.totalVotes);
          const isMyChoice = opinion.myChoiceId === c.id;

          return (
            <button
              key={c.id}
              className={`
                flex items-center gap-2 text-xs w-full text-left border rounded px-2 py-1
                ${hasVoted ? "bg-gray-50" : "bg-white"}
                ${isMyChoice ? "border-blue-400" : "border-gray-200"}
                ${hasVoted ? "cursor-default" : "cursor-pointer"}
              `}
              disabled={hasVoted}
              onClick={() => !hasVoted && onVote(c.id)}
            >
              <span className="flex-1">
                {c.label}
                {isMyChoice && (
                  <span className="ml-1 text-blue-500">（あなたの選択）</span>
                )}
              </span>
              <span className="text-xs text-gray-600">
                {percent}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-500">
        投票数: {opinion.totalVotes}
      </div>
    </Card>
  );
};

export default DiscussionDetailView;
