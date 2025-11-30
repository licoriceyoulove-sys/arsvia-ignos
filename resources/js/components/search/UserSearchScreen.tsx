// resources/js/components/search/UserSearchScreen.tsx
import React from "react";
import type { UserSearchResult } from "../../api/client";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";

type Props = {
  keyword: string;
  onChangeKeyword: (value: string) => void;
  searching: boolean;
  error: string | null;
  results: UserSearchResult[];
  onSearch: () => void;
  onSelectUser: (id: number) => void;
};

export const UserSearchScreen: React.FC<Props> = ({
  keyword,
  onChangeKeyword,
  searching,
  error,
  results,
  onSearch,
  onSelectUser,
}) => {
  const trimmed = keyword.trim();

  return (
    <Card>
      <SectionTitle title="ユーザー検索" />
      <div className="px-4 pb-4 space-y-3">
        {/* 検索フォーム */}
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => onChangeKeyword(e.target.value)}
            placeholder="ユーザー名 / IgnosID を検索"
            className="flex-1 px-3 py-2 border rounded-xl text-sm bg-gray-50 border-gray-200"
          />
          <button
            type="button"
            onClick={onSearch}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold"
          >
            検索
          </button>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}

        {searching && (
          <div className="text-sm text-gray-500">検索中です…</div>
        )}

        {/* 検索結果リスト */}
        <div className="divide-y divide-gray-200">
          {results.map((u) => {
            const displayName = u.display_name || "ゲスト";
            const ignosId = u.ignos_id || String(u.id);

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u.id)}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gray-300" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold">{displayName}</span>
                  <span className="text-xs text-gray-500">@{ignosId}</span>
                </div>
              </button>
            );
          })}

          {!searching && trimmed !== "" && results.length === 0 && (
            <div className="py-3 text-sm text-gray-500">
              該当するユーザーが見つかりませんでした。
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
