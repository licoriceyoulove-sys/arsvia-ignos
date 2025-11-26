// resources/js/components/discussion/DiscussionDetail.tsx
import React from "react";
import type {
  DiscussionDetail as DiscussionDetailType,
  DiscussionOpinion,
  VoteKind,
} from "../../types/discussion";
import { Card } from "../ui/Card";

type Props = {
  detail: DiscussionDetailType;
  onBack: () => void;
  onOpenOpinionComposer: () => void;
  // ★ ここを変更：choiceId:number → vote:VoteKind
  onVote: (opinionId: number, vote: VoteKind) => void;
};

const DiscussionDetailView: React.FC<Props> = ({
  detail,
  onBack,
  onOpenOpinionComposer,
  onVote,
}) => {
  return (
    <div className="flex flex-col h-full pb-16">
      {/* 上部ヘッダー（タイトル＋アジェンダ＋タグ） */}
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
            // ★ opinion.id と vote を親へ渡す
            onVote={(vote) => onVote(opinion.id, vote)}
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
  // ★ ここも VoteKind を使う
  onVote: (vote: VoteKind) => void;
};

const OpinionCard: React.FC<OpinionCardProps> = ({ opinion, onVote }) => {
  const { visible, agree, disagree, pass, total, myVote } = opinion.stats;

  const percent = (n: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const hasVoted = myVote !== null;

  return (
    <Card className="flex flex-col gap-2">
      <div className="text-sm whitespace-pre-wrap">{opinion.body}</div>

      {/* 投票ボタン行 */}
      <div className="flex gap-2 text-xs">
        <VoteButton
          label="賛成"
          active={myVote === "agree"}
          disabled={hasVoted}
          percent={visible ? percent(agree) : undefined}
          onClick={() => onVote("agree")}
        />
        <VoteButton
          label="反対"
          active={myVote === "disagree"}
          disabled={hasVoted}
          percent={visible ? percent(disagree) : undefined}
          onClick={() => onVote("disagree")}
        />
        <VoteButton
          label="パス"
          active={myVote === "pass"}
          disabled={hasVoted}
          percent={visible ? percent(pass) : undefined}
          onClick={() => onVote("pass")}
        />
      </div>

      <div className="text-[11px] text-gray-500">
        {visible ? <>投票数: {total}</> : <>投票後に結果が表示されます</>}
      </div>
    </Card>
  );
};

type VoteButtonProps = {
  label: string;
  active: boolean;
  disabled: boolean;
  // visible=false のときは undefined にして「%」を隠す
  percent?: number;
  onClick: () => void;
};

const VoteButton: React.FC<VoteButtonProps> = ({
  label,
  active,
  disabled,
  percent,
  onClick,
}) => {
  const showPercent = typeof percent === "number";

  return (
    <button
      className={`
        flex-1 border rounded px-2 py-1 flex flex-col items-center
        ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}
        ${disabled && !active ? "opacity-60 cursor-default" : ""}
      `}
      disabled={disabled && !active}
      onClick={onClick}
    >
      <span className="text-xs">{label}</span>
      <span className="text-[11px] text-gray-600 min-h-[1rem]">
        {showPercent ? `${percent}%` : "--"}
      </span>
    </button>
  );
};

export default DiscussionDetailView;
