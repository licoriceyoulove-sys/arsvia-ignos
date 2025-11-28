// resources/js/components/discussion/DiscussionDetail.tsx
import React, { useEffect, useState } from "react";
import type {
  DiscussionDetail as DiscussionDetailType,
  DiscussionOpinion,
  VoteKind,
} from "../../types/discussion";
import { Card } from "../ui/Card";
import { Modal } from "../layout/Modal";

type Props = {
  detail: DiscussionDetailType;
  onBack: () => void;
  onOpenOpinionComposer: () => void;
  // opinionId と vote を受け取る
  onVote: (opinionId: number, vote: VoteKind) => void;
};

const DiscussionDetailView: React.FC<Props> = ({
  detail,
  onBack,
  onOpenOpinionComposer,
  onVote,
}) => {
  // ★ 新しいもの順に並び替え（createdAt の降順）
  const sortedOpinions = [...detail.opinions].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });

  return (
    <div className="flex flex-col h-full pb-16">
      {/* 上部ヘッダー（タイトル＋アジェンダ） */}
      <div className="bg-white border-b">
        <div className="flex items-center gap-2 px-3 py-2">
          <button className="text-sm text-blue-500" onClick={onBack}>
            ← 戻る
          </button>
          <div className="font-semibold text-sm truncate">{detail.title}</div>
        </div>

        {/* 改行・空白を反映しつつ、スクロールで流れる */}
        <div className="px-3 pb-2 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
          {detail.agenda}
        </div>

        {/* タグは今は非表示
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
        */}
      </div>

      {/* 意見一覧 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {sortedOpinions.map((opinion) => (
          <OpinionCard
            key={opinion.id}
            opinion={opinion}
            // opinion.id と vote を親へ渡す
            onVote={(vote) => onVote(opinion.id, vote)}
          />
        ))}

        {sortedOpinions.length === 0 && (
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

  // 合計100%になるようにパーセント計算
  const rawAgree = total > 0 ? (agree / total) * 100 : 0;
  const rawNeutral = total > 0 ? (pass / total) * 100 : 0;

  let agreePercent = Math.round(rawAgree);
  let neutralPercent = Math.round(rawNeutral);
  let disagreePercent = 100 - agreePercent - neutralPercent;

  if (disagreePercent < 0) {
    // マイナスになってしまった分は無関心から引く
    neutralPercent = Math.max(0, neutralPercent + disagreePercent);
    disagreePercent = 0;
  }

  const hasVoted = myVote !== null;

  // 投票の確認モーダル
  const [pendingVote, setPendingVote] = useState<VoteKind | null>(null);

  // 棒グラフのフェードイン＋左右から伸びるアニメーション用
  const [showResults, setShowResults] = useState(false);
  // ラベルを少し遅れて表示する用
  const [labelsVisible, setLabelsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowResults(true);
      const id = window.setTimeout(() => {
        setLabelsVisible(true);
      }, 700); // duration-700 と合わせる
      return () => window.clearTimeout(id);
    } else {
      setShowResults(false);
      setLabelsVisible(false);
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
              onClick={() => setPendingVote("agree")}
            />
            <VoteButton
              label="無関心"
              active={myVote === "pass"}
              disabled={hasVoted}
              onClick={() => setPendingVote("pass")}
            />
            <VoteButton
              label="反対"
              active={myVote === "disagree"}
              disabled={hasVoted}
              onClick={() => setPendingVote("disagree")}
            />
          </div>

          <div className="text-[11px] text-gray-500">
            投票後に結果が表示されます
          </div>
        </>
      )}

      {/* 投票済み → グレーベース＋左右から色が伸びる棒グラフ */}
      {visible && (
        <>
          <div
            className={`
              relative w-full h-6 rounded-full bg-gray-300 overflow-hidden
              transition-opacity duration-500
              ${showResults ? "opacity-100" : "opacity-0"}
            `}
          >
            {/* 左から伸びる賛成（青） */}
            <div
              className="
                absolute left-0 top-0 bottom-0
                bg-blue-400
                transition-[width] duration-700
              "
              style={{
                width: showResults ? `${agreePercent}%` : "0%",
              }}
            />

            {/* 右から伸びる反対（赤） */}
            <div
              className="
                absolute right-0 top-0 bottom-0
                bg-red-400
                transition-[width] duration-700
              "
              style={{
                width: showResults ? `${disagreePercent}%` : "0%",
              }}
            />

            {/* ラベル（棒の上に重ねて表示） */}
            <div
              className={`
                relative z-10 flex items-center justify-between h-full px-1 pointer-events-none
                transition-opacity duration-500
                ${labelsVisible ? "opacity-100" : "opacity-0"}
              `}
            >
              {/* 左：賛成ラベル */}
              {agreePercent > 0 && (
                <span
                  className={`
                    px-1 whitespace-nowrap text-white
                    ${
                      myVote === "agree"
                        ? "text-[13px] font-bold"
                        : "text-[11px]"
                    }
                  `}
                >
                  賛成 {agreePercent}%
                </span>
              )}

              {/* 中央：無関心ラベル */}
              {neutralPercent > 0 && (
                <span
                  className={`
                    px-1 whitespace-nowrap mx-auto text-white
                    ${
                      myVote === "pass"
                        ? "text-[13px] font-bold"
                        : "text-[11px]"
                    }
                  `}
                >
                  無関心 {neutralPercent}%
                </span>
              )}

              {/* 右：反対ラベル */}
              {disagreePercent > 0 && (
                <span
                  className={`
                    px-1 whitespace-nowrap ml-auto text-white
                    ${
                      myVote === "disagree"
                        ? "text-[13px] font-bold"
                        : "text-[11px]"
                    }
                  `}
                >
                  反対 {disagreePercent}%
                </span>
              )}
            </div>
          </div>

          {/* 投票数の補足 */}
          <div className="text-[11px] text-gray-500">投票数: {total}</div>
        </>
      )}

      {/* 投票確認モーダル（アプリ内） */}
      <Modal
        open={pendingVote !== null}
        onClose={() => setPendingVote(null)}
        title="投票の確認"
      >
        <div className="text-sm mb-3">
          {pendingVote === "agree" && "賛成に投票します。よろしいですか？"}
          {pendingVote === "pass" && "無関心に投票します。よろしいですか？"}
          {pendingVote === "disagree" && "反対に投票します。よろしいですか？"}
        </div>

        <div className="flex justify-end gap-2 text-xs">
          <button
            className="px-3 py-1 border rounded text-gray-600"
            onClick={() => setPendingVote(null)}
          >
            キャンセル
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-500 text-white"
            onClick={() => {
              if (!pendingVote) return;
              onVote(pendingVote); // 親（QuizApp 側）へ投票処理を依頼
              setPendingVote(null); // モーダルを閉じる
            }}
          >
            投票する
          </button>
        </div>
      </Modal>
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
