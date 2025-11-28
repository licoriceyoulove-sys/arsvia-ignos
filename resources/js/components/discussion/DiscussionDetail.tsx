// resources/js/components/discussion/DiscussionDetail.tsx
import React, { useEffect, useState } from "react";
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
  // ★ opinionId と vote を受け取る
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
<div className="bg-white border-b">
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

  {/* ★ 改行・空白を反映しつつ、普通にスクロールで流れる */}
  <div className="px-3 pb-2 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
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
  // VoteKind: "agree" | "pass" | "disagree"
  onVote: (vote: VoteKind) => void;
};

const OpinionCard: React.FC<OpinionCardProps> = ({ opinion, onVote }) => {
  const { visible, agree, disagree, pass, total, myVote } = opinion.stats;

  const percent = (n: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  // ★ 合計が必ず 100 になるように調整
  let agreePercent = 0;
  let neutralPercent = 0;
  let disagreePercent = 0;

  if (total > 0) {
    agreePercent = percent(agree);
    neutralPercent = percent(pass); // 無関心
    const rest = 100 - agreePercent - neutralPercent;
    disagreePercent = rest > 0 ? rest : 0;
  }

  const hasVoted = myVote !== null;

  // ★ 棒グラフのフェードイン＋伸びるアニメーション用
  const [showResults, setShowResults] = useState(false);
  // ★ ラベルを少し遅れて表示する用
  const [labelsVisible, setLabelsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowResults(true);
      // 棒グラフの width アニメーションが終わる頃にラベルを出す
      const id = window.setTimeout(() => {
        setLabelsVisible(true);
      }, 700); // duration-700 と合わせる

      return () => window.clearTimeout(id);
    }
  }, [visible]);

  return (
    <Card className="flex flex-col gap-3">
      {/* 意見本文：改行も反映 */}
      <div className="text-sm whitespace-pre-wrap leading-relaxed">
        {opinion.body}
      </div>

      {/* まだ投票していない → ボタン表示 */}
      {!visible && (
        <>
          <div className="flex gap-2 text-xs">
            <VoteButton
              label="賛成"
              active={myVote === "agree"}
              disabled={hasVoted}
              onClick={() => {
                if (window.confirm("賛成に投票します。よろしいですか？")) {
                  onVote("agree");
                }
              }}
            />
            <VoteButton
              label="無関心"
              active={myVote === "pass"}
              disabled={hasVoted}
              onClick={() => {
                if (window.confirm("無関心に投票します。よろしいですか？")) {
                  onVote("pass");
                }
              }}
            />
            <VoteButton
              label="反対"
              active={myVote === "disagree"}
              disabled={hasVoted}
              onClick={() => {
                if (window.confirm("反対に投票します。よろしいですか？")) {
                  onVote("disagree");
                }
              }}
            />
          </div>

          <div className="text-[11px] text-gray-500">
            投票後に結果が表示されます
          </div>
        </>
      )}

      {/* 投票済み → 棒グラフ（中に文字）を表示 */}
      {visible && (
        <>
          {/* 棒グラフ本体：フェードイン＋伸びる */}
          <div
            className={`
              w-full h-6 rounded-full bg-gray-100 overflow-hidden
              transition-opacity duration-500
              ${showResults ? "opacity-100" : "opacity-0"}
            `}
          >
            <div className="w-full h-full flex text-[11px] text-white font-medium">
              {/* 賛成（左・青） */}
              <div
                className={`
                  h-full flex items-center justify-center bg-blue-400
                  transition-all duration-700
                  origin-left
                `}
                style={{
                  width: showResults ? `${agreePercent}%` : "0%",
                }}
              >
                {labelsVisible && agreePercent > 0 && (
                  <span className="px-1 whitespace-nowrap">
                    賛成 {agreePercent}%
                  </span>
                )}
              </div>

              {/* 無関心（中央・グレー） */}
              <div
                className={`
                  h-full flex items-center justify-center bg-gray-400
                  transition-all duration-700
                  delay-75
                `}
                style={{
                  width: showResults ? `${neutralPercent}%` : "0%",
                }}
              >
                {labelsVisible && neutralPercent > 0 && (
                  <span className="px-1 whitespace-nowrap">
                    無関心 {neutralPercent}%
                  </span>
                )}
              </div>

              {/* 反対（右・赤） */}
              <div
                className={`
                  h-full flex items-center justify-center bg-red-400
                  transition-all duration-700
                  origin-right
                  delay-150
                `}
                style={{
                  width: showResults ? `${disagreePercent}%` : "0%",
                }}
              >
                {labelsVisible && disagreePercent > 0 && (
                  <span className="px-1 whitespace-nowrap">
                    反対 {disagreePercent}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 投票数の補足 */}
          <div className="text-[11px] text-gray-500">
            投票数: {total}
          </div>
        </>
      )}
    </Card>
  );
};



type VoteButtonProps = {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
};

const VoteButton: React.FC<VoteButtonProps> = ({
  label,
  active,
  disabled,
  onClick,
}) => {
  return (
    <button
      className={`
        flex-1 border rounded px-2 py-1
        text-xs
        ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}
        ${disabled && !active ? "opacity-60 cursor-default" : ""}
      `}
      disabled={disabled && !active}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default DiscussionDetailView;
