// resources/js/hooks/useFeed.ts
import { useCallback, useEffect, useState } from "react";
import { getQuizzes, getGlobalQuizzes } from "../api/client";
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

    // QuizApp 内の feed 構築ロジックをそのまま関数化
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

for (const [bundleId, postsInBundle] of byBundle) {
  if (postsInBundle.length >= 2) {
    // ★ undefined のときは 0 として扱う
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

    const reloadFeed = useCallback(async () => {
        if (!currentUserId) return;

        try {
            const rows = await getQuizzes(currentUserId);
            const apiPosts: QuizPost[] = rows.map(fromQuizRow);

            setPosts(apiPosts);

            const authorSummary = apiPosts.reduce<Record<number, number>>(
                (acc, p) => {
                    const id = p.author_id ?? -1;
                    acc[id] = (acc[id] ?? 0) + 1;
                    return acc;
                },
                {}
            );
            console.log("DEBUG /quizzes author summary =", authorSummary);

            const feedItems = buildFeedFromPosts(apiPosts);
            setFeed(feedItems);
        } catch (e) {
            console.error("API /quizzes 取得に失敗しました", e);
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

    // 一定時間ごとに最新投稿を取得
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
