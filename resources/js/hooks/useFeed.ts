// resources/js/hooks/useFeed.ts
import { useCallback, useEffect, useState } from "react";
import { getQuizzes, getGlobalQuizzes, getFeed } from "../api/client";
import { fromQuizRow } from "../api/mapper";
import type { QuizPost, FeedItem, FeedQuizBundleItem } from "../types/quiz";

type UseFeedResult = {
  posts: QuizPost[];
  setPosts: React.Dispatch<React.SetStateAction<QuizPost[]>>;
  feed: FeedItem[];
  setFeed: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  globalPosts: QuizPost[];
  setGlobalPosts: React.Dispatch<React.SetStateAction<QuizPost[]>>;
  reloadFeed: () => Promise<void>;
};

export function useFeed(
  currentUserId: number | null | undefined
): UseFeedResult {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [globalPosts, setGlobalPosts] = useState<QuizPost[]>([]);

  // ★ 元のタイムライン構築ロジック（そのまま）
  const buildFeedFromPosts = useCallback((apiPosts: QuizPost[]): FeedItem[] => {
    const byBundle = new Map<string, QuizPost[]>();
    const singles: QuizPost[] = [];

    for (const p of apiPosts) {
      if (p.bundleId) {
        const key = p.bundleId;
        const list = byBundle.get(key) ?? [];
        list.push(p);
        byBundle.set(key, list);
      } else {
        singles.push(p);
      }
    }

    const feedItems: FeedItem[] = [];

    // まとめ投稿
    for (const [bundleId, postsInBundle] of byBundle) {
      if (postsInBundle.length >= 2) {
        postsInBundle.sort((a, b) => {
          const ao = a.bundleOrder ?? 0;
          const bo = b.bundleOrder ?? 0;
          return ao - bo;
        });

        const createdAt = postsInBundle[0].createdAt;
        feedItems.push({
          id: `bundle_${bundleId}`,
          kind: "quizBundle",
          data: postsInBundle,
          createdAt,
          likes: 0,
          retweets: 0,
          answers: 0,
        } as FeedQuizBundleItem);
      } else {
        singles.push(postsInBundle[0]);
      }
    }

    // 単発投稿
    for (const p of singles) {
      feedItems.push({
        id: p.id,
        kind: "quiz",
        data: p,
        createdAt: p.createdAt,
        likes: 0,
        retweets: 0,
        answers: 0,
      });
    }

    feedItems.sort((a, b) => b.createdAt - a.createdAt);
    return feedItems;
  }, []);

  // ★ feedRows から「タイムライン側のキー」を作るヘルパー
  const getFeedKeyFromFeedRow = (row: FeedItem): string | null => {
    if (row.kind === "quiz") {
      const raw = row.data as QuizPost;
      // タイムライン側は単発クイズの id をそのまま使っている
      return raw.id;
    }

    if (row.kind === "quizBundle") {
      const bundleRow = row as FeedQuizBundleItem;
      const posts = bundleRow.data as QuizPost[];
      const first = posts[0];
      if (!first) return null;

      // タイムライン側は "bundle_" + bundleId を key にしている
      if (first.bundleId) {
        return `bundle_${first.bundleId}`;
      }

      // bundleId が無い古いデータの場合は、fallback として feed_items.id を使う
      return row.id;
    }

    // share など、クイズと紐付かないものはそのまま feed.id を使う
    return row.id;
  };

  const reloadFeed = useCallback(async () => {
    if (!currentUserId) return;

    try {
      // ① まず /api/quizzes から「表示対象のクイズ一覧」を取得（元の挙動）
      const quizRows = await getQuizzes(currentUserId);
      const apiPosts: QuizPost[] = quizRows.map(fromQuizRow);
      setPosts(apiPosts);

      // ② 既存ロジックでタイムラインを構築（ここでは likes/retweets は 0 のまま）
      const baseFeed = buildFeedFromPosts(apiPosts);

      // ③ /api/feed から reactions 集計済みの値を取得
      const feedRows = await getFeed();

      // feedRows から「タイムライン側で使う key → 集計値」のマップを作る
      const aggMap = new Map<
        string,
        { likes: number; retweets: number; answers: number }
      >();

      for (const row of feedRows) {
        const key = getFeedKeyFromFeedRow(row as FeedItem);
        if (!key) continue;

        aggMap.set(key, {
          likes: row.likes ?? 0,
          retweets: row.retweets ?? 0,
          answers: row.answers ?? 0,
        });
      }

      // ④ baseFeed に対して、key が一致するものだけ集計値で上書き
      const mergedFeed: FeedItem[] = baseFeed.map((item) => {
        const agg = aggMap.get(item.id);
        if (!agg) return item;

        return {
          ...item,
          likes: agg.likes,
          retweets: agg.retweets,
          answers: agg.answers,
        };
      });

      setFeed(mergedFeed);
    } catch (e) {
      console.error("reloadFeed failed", e);
    }
  }, [currentUserId, buildFeedFromPosts]);

  // 初回ロード
  useEffect(() => {
    if (!currentUserId) return;
    void reloadFeed();
  }, [currentUserId, reloadFeed]);

  // グローバルクイズ
  useEffect(() => {
    const loadGlobal = async () => {
      try {
        const rows = await getGlobalQuizzes();
        const apiPosts = rows.map(fromQuizRow);
        setGlobalPosts(apiPosts);
      } catch (e) {
        console.error("API /quizzes/global 取得に失敗しました", e);
      }
    };

    void loadGlobal();
  }, []);

  // 一定時間ごとに最新フィードを取得
  useEffect(() => {
    if (!currentUserId) return;

    const intervalId = window.setInterval(() => {
      void reloadFeed();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUserId, reloadFeed]);

  return {
    posts,
    setPosts,
    feed,
    setFeed,
    globalPosts,
    setGlobalPosts,
    reloadFeed,
  };
}
