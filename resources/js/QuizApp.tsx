// ファイル構成図
// resources/js/
//   QuizApp.tsx                // 画面のルート。状態管理＆画面切り替えだけに寄せていく

//   api/
//     client.ts                // 既存
//     mapper.ts                // 既存

//   types/
//     quiz.ts                  // 型定義をここに集約（QuizPost / FeedItem / Visibility など）

//   components/
//     layout/
//       Header.tsx             // 画面上部ヘッダー
//       BottomNav.tsx          // 画面下部ナビ
//       Modal.tsx              // フルスクリーンモーダル

//     ui/
//       Card.tsx               // 共通カード
//       SectionTitle.tsx       // セクションタイトル
//       TagChip.tsx            // タグのチップ表示
//       ActionBar.tsx          // いいね／RT／回答ボタン

//     folders/
//       FolderList.tsx         // 「タグから探す」画面（フォルダ一覧）

//     quiz/
//       QuizRunner.tsx         // タグからランダム10問
//       AnswerRunner.tsx       // 1投稿（またはバンドル）に対するクイズ実行

//     composer/
//       Composer.tsx           // 投稿モーダル全体
//       MultiEditor.tsx        // 複数問題エディタ（Composer の子）

import React, { useEffect, useMemo, useState } from "react";
// import { getQuizzes } from "./api/client";

import { fromQuizRow } from "./api/mapper";
// import { bulkUpsertQuizzes, postFeed, patchFeed, API_BASE } from "./api/client";
import {
  getUserQuizzes,
  bulkUpsertQuizzes,
  postFeed,
  patchFeed,
  API_BASE,
  searchUsers,
  deleteQuizzes,
  updateQuizVisibility,
} from "./api/client";

import { FolderList } from "./components/folders/FolderList";
import { QuizRunner, AnswerRunner } from "./components/quiz/QuizRunner";
import { Composer } from "./components/composer/Composer";
import { BulkImportDialog } from "./components/composer/BulkImportDialog";
import { VisibilityModal } from "./components/quiz/VisibilityModal";
import { ShareDialog } from "./components/home/ShareDialog";
import { FabPostButton } from "./components/home/FabPostButton";
import { Sidebar } from "./components/layout/Sidebar";
import { ToolsPalette } from "./components/layout/ToolsPalette";
import { UserSearchScreen } from "./components/search/UserSearchScreen";
import { NotificationsScreen } from "./components/notifications/NotificationsScreen";
import { HomeFeedScreen } from "./components/home/HomeFeedScreen";

import { useFeed } from "./hooks/useFeed";
import { useCategories } from "./hooks/useCategories";

import type {
    UserSearchResult,
    CategoryLarge,
    CategoryMiddle,
    CategorySmall,
} from "./api/client";
import { toQuizRow, toFeedRow } from "./api/mapper";
// import axios from "axios";
import type {
    QuizType,
    Visibility,
    QuizPost,
    QuizSeed,
    SharePost,
    FeedItem,
    FeedQuizBundleItem,
} from "./types/quiz";
import Header from "./components/layout/Header";
import { BottomNav } from "./components/layout/BottomNav";
import { Modal } from "./components/layout/Modal";

import { Card } from "./components/ui/Card";
import { SectionTitle } from "./components/ui/SectionTitle";
import { TagChip } from "./components/ui/TagChip";
import { ActionBar } from "./components/ui/ActionBar";

import {
    CURRENT_USER_ID,
    pickDisplayName,
    getCurrentUserIgnosId,
} from "./utils/user";
import { IS_ADMIN } from "./utils/user";
console.log("DEBUG Current User ID =", CURRENT_USER_ID);
console.log("DEBUG accountLevel =", window.Ignos?.accountLevel);
console.log("DEBUG IS_ADMIN =", IS_ADMIN);

import { ProfileScreen } from "./components/profile/ProfileScreen";
import { QuizPostCard } from "./components/ui/QuizPostCard";

// 議論系
import DiscussionList from "./components/discussion/DiscussionList";
import DiscussionDetailView from "./components/discussion/DiscussionDetail";
import DiscussionComposer from "./components/discussion/DiscussionComposer";
import OpinionComposer from "./components/discussion/OpinionComposer";
import {
    fetchDiscussions,
    fetchDiscussionDetail,
    createDiscussion,
    createOpinion,
    voteOpinion,
} from "./api/discussion";
import type {
    DiscussionSummary,
    DiscussionDetail,
    DiscussionOpinion,
    OpinionVoteStats,
    VoteKind,
} from "./types/discussion";
import { VisibilityIcon } from "./components/ui/VisibilityIcon";
// ★ フォロー中ユーザーID一覧

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* =========================
   カテゴリJSON自動読み込み
========================= */
// Vite: src/data/categories/*.json を一括 import
type JsonModule = { default: QuizSeed[] };
const CATEGORY_GLOB = import.meta.glob<JsonModule>("./data/categories/*.json", {
    eager: true,
});

// パス -> カテゴリキー（拡張子除去）
const fileKeyToCategory = (path: string) => {
    const name = path.split("/").pop() || "category";
    return name.replace(/\.json$/i, "");
};

/* =========================
   UI パーツ
========================= */
const iconUrl = (name: string) => `./build/icons/${name}.png`;

/* =========================
   クイズ実行
========================= */
type PreparedQuestion = {
    post: QuizPost;
    idx: number;
    // 出題用にシャッフルした選択肢 & 表示上の正解インデックス
    displayChoices?: string[];
    answerIndex?: number;
};
type QuizStage = "answering" | "revealed" | "finished";

// 選択肢シャッフル（Fisher–Yates）
const shuffleChoicesWithAnswer = (choices: string[], correctIndex: number) => {
    const idx = choices.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const displayChoices = idx.map((i) => choices[i]);
    const answerIndex = idx.indexOf(correctIndex);
    return { displayChoices, answerIndex };
};

// ランダム10問準備（choice はこの時点でシャッフル）
const pickRandom10 = (pool: QuizPost[]): PreparedQuestion[] => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const slice = shuffled.slice(0, Math.min(10, shuffled.length));
    return slice.map((post, i) => {
        if (
            post.type === "choice" &&
            post.choices &&
            typeof post.correctIndex === "number"
        ) {
            const { displayChoices, answerIndex } = shuffleChoicesWithAnswer(
                post.choices,
                post.correctIndex
            );
            return { post, idx: i, displayChoices, answerIndex };
        }
        return { post, idx: i };
    });
};

/* =========================
   メインアプリ
========================= */
export default function QuizApp() {
    // const [posts, setPosts] = useState<QuizPost[]>([]);
    // const [feed, setFeed] = useState<FeedItem[]>([]);
    // const [globalPosts, setGlobalPosts] = useState<QuizPost[]>([]);

      const {
    posts,
    setPosts,
    feed,
    setFeed,
    globalPosts,
    setGlobalPosts,
    reloadFeed,
  } = useFeed(CURRENT_USER_ID);

    // ★ この端末・このセッションで「Thanks / Look を押した feed_id の一覧」
    const [thanksFeedIds, setThanksFeedIds] = useState<string[]>([]);
    const [retweetedFeedIds, setRetweetedFeedIds] = useState<string[]>([]);

    const postsForTags = useMemo(() => {
        const map = new Map<string, QuizPost>();
        posts.forEach((p) => map.set(p.id, p));
        globalPosts.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
    }, [posts, globalPosts]);

    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);

    const [composerMode, setComposerMode] = useState<"create" | "edit">(
        "create"
    );
    const [editTargetPosts, setEditTargetPosts] = useState<QuizPost[] | null>(
        null
    );
    const [editFeedId, setEditFeedId] = useState<string | null>(null);

    const [mode, setMode] = useState<
        | "home"
        | "folders"
        | "quiz"
        | "search"
        | "notifications"
        | "answer"
        | "profile"
        | "discussions" // ★議論一覧
        | "discussionDetail" // ★議論詳細
    >("home");
    const [answerPool, setAnswerPool] = useState<QuizPost[] | null>(null);
    // const [hasApiData, setHasApiData] = useState(false);

    // 検索（ユーザー）関連 state
    const [userKeyword, setUserKeyword] = useState<string>("");
    const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
    const [userSearching, setUserSearching] = useState(false);
    const [userSearchError, setUserSearchError] = useState<string | null>(null);

    // 共有モーダル
    const [shareOpen, setShareOpen] = useState(false);
    const [shareTag, setShareTag] = useState<string>("");
    const [shareMessage, setShareMessage] = useState<string>("");
    const [followIds, setFollowIds] = useState<number[]>([]);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    // フォロー中ユーザーID一覧
    const [profilePosts, setProfilePosts] = useState<QuizPost[]>([]);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileFollowingCount, setProfileFollowingCount] = useState(0);
    const [profileFollowerCount, setProfileFollowerCount] = useState(0);
    const [profileIsFollowing, setProfileIsFollowing] = useState(false);

    // const [categoryLarges, setCategoryLarges] = useState<CategoryLarge[]>([]);
    // const [categoryMiddles, setCategoryMiddles] = useState<CategoryMiddle[]>(
    //     []
    // );
    // const [categorySmalls, setCategorySmalls] = useState<CategorySmall[]>([]);

    const {
  categoryLarges,
  categoryMiddles,
  categorySmalls,
} = useCategories();

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isToolsOpen, setToolsOpen] = useState(false);
    const [bulkImportOpen, setBulkImportOpen] = useState(false);

    const [discussions, setDiscussions] = useState<DiscussionSummary[]>([]);
    const [discussionKeyword, setDiscussionKeyword] = useState("");
    const [selectedDiscussion, setSelectedDiscussion] =
        useState<DiscussionDetail | null>(null);

    const [isDiscussionComposerOpen, setIsDiscussionComposerOpen] =
        useState(false);
    const [isOpinionComposerOpen, setIsOpinionComposerOpen] = useState(false);

    // ★ 公開範囲変更モーダル用 state
    const [visibilityModal, setVisibilityModal] = useState<{
        quizId: string;
        current: Visibility;
    } | null>(null);
    const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

    const openVisibilityModal = (
        quizId: string,
        current?: Visibility | null
    ) => {
        const safeCurrent: Visibility = (current ?? 3) as Visibility; // デフォルト: グローバル
        setVisibilityModal({ quizId, current: safeCurrent });
    };

    const closeVisibilityModal = () => {
        setVisibilityModal(null);
    };

    const handleChangeVisibility = async (v: Visibility) => {
        if (!visibilityModal) return;

        const quizId = visibilityModal.quizId;

        try {
            setIsUpdatingVisibility(true);

            // 1) API で公開範囲を更新
            await updateQuizVisibility(quizId, v);

            // 2) posts / globalPosts の visibility を更新
            setPosts((prev) =>
                prev.map((p) => (p.id === quizId ? { ...p, visibility: v } : p))
            );
            setGlobalPosts((prev) =>
                prev.map((p) => (p.id === quizId ? { ...p, visibility: v } : p))
            );

            // 3) ★ feed の中の該当投稿も更新（単発 / まとめ両方）
            setFeed((prev) =>
                prev.map((item) => {
                    if (item.kind === "quiz") {
                        // 単発投稿
                        const quiz = item.data as QuizPost;
                        if (quiz.id !== quizId) return item;
                        return {
                            ...item,
                            data: { ...quiz, visibility: v },
                        };
                    }

                    if (item.kind === "quizBundle") {
                        // まとめ投稿：中の配列のうち該当クイズだけ visibility 更新
                        const updatedBundle = item.data.map((p) =>
                            p.id === quizId ? { ...p, visibility: v } : p
                        );
                        return {
                            ...item,
                            data: updatedBundle,
                        };
                    }

                    // share など他の種類はそのまま
                    return item;
                })
            );

            // 4) モーダルを閉じる
            setVisibilityModal(null);
        } catch (e) {
            console.error(e);
            alert("公開範囲の変更に失敗しました。");
        } finally {
            setIsUpdatingVisibility(false);
        }
    };

    // 議論API呼び出し関数
    const loadDiscussions = async () => {
        const list = await fetchDiscussions(discussionKeyword || undefined);
        setDiscussions(list);
    };

    const openDiscussion = async (id: number) => {
        const detail = await fetchDiscussionDetail(id); // ★ 引数は1つだけ
        setSelectedDiscussion(detail);
        setMode("discussionDetail");
    };

    async function handleCreateDiscussion(payload: {
        title: string;
        agenda: string;
        tags: string[];
    }) {
        try {
            const created = await createDiscussion(payload, CURRENT_USER_ID);
            // 一覧に先頭追加して画面に反映
            setDiscussions((prev) => [created, ...prev]);
            setIsDiscussionComposerOpen(false);
        } catch (e) {
            console.error("Failed to create discussion", e);
        }
    }

    const handleCreateOpinion = async (payload: { body: string }) => {
        if (!selectedDiscussion) return;
        try {
            const opinion = await createOpinion(selectedDiscussion.id, payload);
            setSelectedDiscussion((prev) =>
                prev ? { ...prev, opinions: [opinion, ...prev.opinions] } : prev
            );
            setIsOpinionComposerOpen(false);
        } catch (e) {
            console.error("Failed to create opinion", e);
        }
    };

    const handleVoteOpinion = async (opinionId: number, vote: VoteKind) => {
        await voteOpinion(opinionId, vote);
        if (selectedDiscussion) {
            const detail = await fetchDiscussionDetail(selectedDiscussion.id);
            setSelectedDiscussion(detail);
        }
    };

    useEffect(() => {
        if (!CURRENT_USER_ID) return; // 未ログインなら何もしない

        (async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/follows?viewer_id=${encodeURIComponent(
                        String(CURRENT_USER_ID)
                    )}`,
                    { credentials: "include" }
                );

                if (!res.ok) {
                    console.error("follows fetch failed status =", res.status);
                    return;
                }

                const json = await res.json();
                const ids: number[] = json.ids ?? [];
                setFollowIds(ids);
                console.log("DEBUG followIds =", ids);
            } catch (e) {
                console.error("follows fetch failed", e);
            }
        })();
    }, []);

    const startQuiz = (tag: string) => {
        setSelectedTag(tag);
        setMode("quiz");
    };

    const openProfile = async (userId?: number | null) => {
        console.log("openProfile userId =", userId);
        if (!userId || userId === 0) return;

        setProfileUserId(userId);
        setMode("profile");

        setProfileLoading(true);
        setProfileError(null);
        setProfilePosts([]);
        setProfileFollowingCount(0);
        setProfileFollowerCount(0);
        setProfileIsFollowing(false);
        try {
            // ① プロフィール対象ユーザーの投稿取得
            const rows = await getUserQuizzes(userId);
            const apiPosts: QuizPost[] = rows.map(fromQuizRow);
            setProfilePosts(apiPosts);

            // ② フォロー数／フォロワー数/フォロー状態
            const statsRes = await fetch(
                `${API_BASE}/users/${userId}/follow-stats?viewer_id=${
                    CURRENT_USER_ID ?? 0
                }`,
                {
                    credentials: "include",
                    headers: { "X-Requested-With": "XMLHttpRequest" },
                }
            );
            if (statsRes.ok) {
                const json = await statsRes.json();
                setProfileFollowingCount(json.following_count);
                setProfileFollowerCount(json.follower_count);
                setProfileIsFollowing(!!json.is_following);
            }
        } catch (e) {
            console.error("openProfile failed", e);
            setProfileError("プロフィール情報の取得に失敗しました");
        } finally {
            setProfileLoading(false);
        }
    };

    const handleUserSearch = async () => {
        const q = userKeyword.trim();
        if (!q) {
            setUserResults([]);
            setUserSearchError(null);
            return;
        }

        setUserSearching(true);
        setUserSearchError(null);

        try {
            const users = await searchUsers(q);
            setUserResults(users);
        } catch (e) {
            console.error(e);
            setUserSearchError("ユーザー検索に失敗しました");
        } finally {
            setUserSearching(false);
        }
    };

    const toggleFollow = async (targetId: number) => {
        if (!CURRENT_USER_ID || !targetId) return;

        try {
            const res = await fetch(`${API_BASE}/follows/toggle`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                credentials: "include",
                body: JSON.stringify({
                    user_id: CURRENT_USER_ID,
                    target_user_id: targetId,
                }),
            });

            if (!res.ok) {
                console.error("toggleFollow failed status =", res.status);
                return;
            }

            const json = await res.json();
            const following: boolean = !!json.following;

            setFollowIds((prev) => {
                if (following) {
                    if (prev.includes(targetId)) return prev;
                    return [...prev, targetId];
                } else {
                    return prev.filter((id) => id !== targetId);
                }
            });

            if (profileUserId === targetId) {
                setProfileIsFollowing(following);
                setProfileFollowerCount((prev) =>
                    following ? prev + 1 : Math.max(0, prev - 1)
                );
            }

            // ★ フォロー状態が変わったので、ホーム用のクイズ/フィードを再取得
            // await loadQuizzesAndFeed();
        } catch (e) {
            console.error("toggleFollow failed", e);
        }
    };

    const backToFolders = () => setMode("folders");

    // 追加：単発/まとめ投稿の編集結果を適用（追加・更新・削除を反映）
    const applyEditBundle = ({
        posts: updatedPosts,
        deletedIds,
    }: {
        posts: QuizPost[];
        deletedIds: string[];
    }) => {
        // ① posts state を更新（削除 + 更新 + 追加）
        setPosts((prev) => {
            const deletedSet = new Set(deletedIds);
            const updatedMap = new Map(updatedPosts.map((p) => [p.id, p]));

            // 既存のうち「削除されていない」ものを残しつつ、更新対象は差し替え
            const kept = prev
                .filter((p) => !deletedSet.has(p.id))
                .map((p) => updatedMap.get(p.id) ?? p);

            // prev に存在しなかった新規ID（編集で追加された問題）を append
            const prevIds = new Set(prev.map((p) => p.id));
            const added = updatedPosts.filter((p) => !prevIds.has(p.id));

            return [...kept, ...added];
        });

        // ② feed を更新（単発 / まとめ両対応）
        setFeed((prev) =>
            prev
                .map((item) => {
                    if (item.id !== editFeedId) return item;

                    if (item.kind === "quiz") {
                        // 単発編集：0件（全削除）の場合は後で feed からも消す
                        return updatedPosts[0]
                            ? { ...item, data: updatedPosts[0] }
                            : item;
                    }

                    if (item.kind === "quizBundle") {
                        // まとめ編集：data を差し替え
                        return { ...item, data: updatedPosts };
                    }

                    return item;
                })
                .filter((item) => {
                    // 単発投稿が削除された場合：updatedPosts が空なら feed からも削除
                    if (item.id === editFeedId && item.kind === "quiz") {
                        return updatedPosts.length > 0;
                    }
                    // まとめ投稿で全問削除されてしまった場合：feed から削除
                    if (item.id === editFeedId && item.kind === "quizBundle") {
                        const bundle = item as FeedQuizBundleItem;
                        return bundle.data.length > 0;
                    }
                    return true;
                })
        );

        // ③ DB: 更新されたものは upsert、削除されたものは delete
        bulkUpsertQuizzes(updatedPosts.map(toQuizRow)).catch(() => {});
        deleteQuizzes(deletedIds).catch(() => {});
    };

    // 追加：まとめて投稿
    const addPostBundle = (bundle: QuizPost[]) => {
        // posts には問題を全て展開して格納
        setPosts((prev) => [...bundle, ...prev]);

        // feed は1アイテム（quizBundle）として登録
        const createdAt = bundle[0]?.createdAt ?? Date.now();
        const bundleId = bundle[0]?.bundleId;
        const feedId = bundleId ? `bundle_${bundleId}` : uid();
        const item: FeedQuizBundleItem = {
            id: feedId,
            kind: "quizBundle",
            data: bundle,
            createdAt,
            likes: 0,
            retweets: 0,
            answers: 0,
        };
        setFeed((prev) => [item, ...prev]);
        // 2) APIへ fire-and-forget 保存（失敗は無視）
        bulkUpsertQuizzes(bundle.map(toQuizRow)).catch(() => {});
        postFeed(toFeedRow(item as any)).catch(() => {});
    };

    // const handleBulkImported = (newPosts: QuizPost[]) => {
    //     if (!newPosts.length) return;

    //     // 1) posts に追加
    //     setPosts((prev) => [...newPosts, ...prev]);

    //     // 2) feed にも追加（単発投稿として扱う）
    //     const newFeedItems: FeedItem[] = newPosts.map((p) => ({
    //         id: p.id,
    //         kind: "quiz",
    //         data: p,
    //         createdAt: p.createdAt,
    //         likes: 0,
    //         retweets: 0,
    //         answers: 0,
    //     }));
    //     setFeed((prev) => [...newFeedItems, ...prev]);

    //     // 3) DB に保存
    //     bulkUpsertQuizzes(newPosts.map(toQuizRow)).catch(() => {});
    // };
const handleBulkImported = (newPosts: QuizPost[]) => {
  if (!newPosts.length) return;

  // 1つのまとめ投稿用の bundleId を採番
  const bundleId = uid();
  const baseTime = Date.now();

  // 各問題に bundleId / bundleOrder を付与して 1 つのバンドルにする
  const bundle: QuizPost[] = newPosts.map((p, idx) => ({
    ...p,
    bundleId,
    bundleOrder: idx,
    // createdAt が未設定ならここで埋めておく（念のため）
    createdAt: p.createdAt ?? baseTime + idx,
  }));

  // 既に用意してある「まとめ投稿」用の関数に丸投げ
  addPostBundle(bundle);
};


    const visibleFeed = useMemo(() => {
        // /api/quizzes が viewer_id に応じて
        // 「自分の全投稿＋フォロー中ユーザーの visibility != 1 の投稿」
        // だけを返しているので、ここでは追加の絞り込みを行わない
        return feed;
    }, [feed]);

    // 共有フロー
    const openShare = (tag: string) => {
        setShareTag(tag);
        setShareMessage(`${tag}の問題を公開しました！`);
        setShareOpen(true);
    };
    const confirmShare = () => {
        const item: SharePost = {
            id: uid(),
            kind: "share",
            tag: shareTag,
            message: `${shareMessage} （リンク）`,
            createdAt: Date.now(),
            likes: 0,
            retweets: 0,
        };
        setFeed((prev) => [item, ...prev]);
        setShareOpen(false);
        setMode("home");

        postFeed(toFeedRow(item as any)).catch(() => {});
    };

    const openEditForFeedItem = (item: FeedItem) => {
        if (item.kind === "quiz") {
            // 単発 → 配列1件として扱う
            setEditTargetPosts([item.data]);
        } else if (item.kind === "quizBundle") {
            // まとめ投稿 → そのまま配列で
            setEditTargetPosts(item.data);
        } else {
            // share は編集対象外
            return;
        }

        setEditFeedId(item.id);
        setComposerMode("edit");
        setComposerOpen(true);
    };

    // ★ Thanks（いいね）：1ユーザーにつき1回だけ増える
    const incLike = (id: string) => {
        patchFeed(id, "likes")
            .then((res) => {
                if (!("reacted" in res)) return; // answers 用レスポンスではない

                // DB 集計結果で likes を上書き
                setFeed((prev) =>
                    prev.map((it) =>
                        it.id === id ? { ...it, likes: res.likes } : it
                    )
                );

                // 押した / 解除 の状態をローカルにも反映
                setThanksFeedIds((prev) => {
                    if (res.reacted) {
                        // 今回「押した」→リストに追加
                        if (prev.includes(id)) return prev;
                        return [...prev, id];
                    } else {
                        // 今回「解除」→リストから削除
                        return prev.filter((x) => x !== id);
                    }
                });
            })
            .catch((e) => {
                console.error("incLike failed", e);
            });
    };

    // ★ Look（RT）：1ユーザーにつき1回だけ増える
    const incRT = (id: string) => {
        patchFeed(id, "retweets")
            .then((res) => {
                if (!("reacted" in res)) return;

                setFeed((prev) =>
                    prev.map((it) =>
                        it.id === id ? { ...it, retweets: res.retweets } : it
                    )
                );

                setRetweetedFeedIds((prev) => {
                    if (res.reacted) {
                        if (prev.includes(id)) return prev;
                        return [...prev, id];
                    } else {
                        return prev.filter((x) => x !== id);
                    }
                });
            })
            .catch((e) => {
                console.error("incRT failed", e);
            });
    };

    const incAnswer = (id: string) => {
        patchFeed(id, "answers")
            .then((res) => {
                if (!("answers" in res)) return;

                setFeed((prev) =>
                    prev.map((it) =>
                        it.id === id ? { ...it, answers: res.answers } : it
                    )
                );
            })
            .catch((e) => {
                console.error("incAnswer failed", e);
            });
    };

    const toggleMark = (feedId: string) => {
        setFeed((prev) =>
            prev.map((item) =>
                item.id === feedId
                    ? { ...item, isMarked: !item.isMarked }
                    : item
            )
        );
    };
    const activeTab = mode;
const handleHome = () => {
  if (mode !== "home") {
    // 他のタブからホームへ遷移
    setMode("home");
    // 上までスムーズスクロール
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // すでにホームにいる → フィード再読み込みしてから上へスクロール
    reloadFeed(); // ★ ここを loadQuizzesAndFeed ではなく reloadFeed に
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
    return (
        // 背景色切り替え
        // bg-white 真っ白
        // bg-[#FAF9F6] 紙の質感に近い
        // bg-[#F7F3E9] 少しクリーム寄り
        // bg-[#FDFCF7] 現代Webアプリで使われるナチュラル系
        <div className="min-h-[100dvh] bg-[#FAF9F6] text-gray-900 pb-16">
            <Header
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenTools={() => setToolsOpen(true)}
            />

            <div className="max-w-md mx-auto">
                {/* HOME */}
                {mode === "home" && (
  <HomeFeedScreen
    feed={visibleFeed}
    currentUserId={CURRENT_USER_ID}
    thanksFeedIds={thanksFeedIds}
    retweetedFeedIds={retweetedFeedIds}
    onAnswerSingle={(post, feedId) => {
      incAnswer(feedId);
      setAnswerPool([post]);
      setMode("answer");
    }}
    onAnswerBundle={(posts, feedId) => {
      incAnswer(feedId);
      setAnswerPool(posts);
      setMode("answer");
    }}
    onLike={incLike}
    onRT={incRT}
    onToggleMark={toggleMark}
    onEditFeedItem={openEditForFeedItem}
    onOpenProfile={(userId) => {
      // HomeFeedScreen から来る userId は number | null | undefined
      if (userId) {
        void openProfile(userId);
      }
    }}
    onTagClick={startQuiz}
    onClickVisibility={(quizId, visibility) =>
      openVisibilityModal(quizId, visibility)
    }
  />
)}


                {/* FOLDERS */}
                {mode === "folders" && (
                    <FolderList
                        posts={postsForTags}
                        onStartQuiz={startQuiz}
                        onShare={openShare}
                        // categoryTree={[]}
                        categoryLarges={categoryLarges}
                        categoryMiddles={categoryMiddles}
                        categorySmalls={categorySmalls}
                    />
                )}

                {/* DISCUSSIONS：議論一覧 */}
                {mode === "discussions" && (
                    <DiscussionList
                        keyword={discussionKeyword}
                        discussions={discussions}
                        onKeywordChange={setDiscussionKeyword}
                        onSearch={loadDiscussions}
                        onSelectDiscussion={openDiscussion}
                        onOpenComposer={() => setIsDiscussionComposerOpen(true)}
                    />
                )}

                {/* DISCUSSION DETAIL：議論詳細 */}
                {mode === "discussionDetail" && selectedDiscussion && (
                    <DiscussionDetailView
                        detail={selectedDiscussion}
                        onBack={() => setMode("discussions")}
                        onOpenOpinionComposer={() =>
                            setIsOpinionComposerOpen(true)
                        }
                        onVote={handleVoteOpinion}
                    />
                )}

                {/* QUIZ */}
                {mode === "quiz" && selectedTag && (
                    <QuizRunner
                        tag={selectedTag}
                        posts={postsForTags}
                        onBack={backToFolders}
                        followIds={followIds}
                        onToggleFollow={toggleFollow}
                    />
                )}

                {mode === "answer" && answerPool && (
                    <AnswerRunner
                        posts={answerPool}
                        onBack={() => {
                            setAnswerPool(null);
                            setMode("home");
                        }}
                        followIds={followIds}
                        onToggleFollow={toggleFollow}
                    />
                )}

{/* SEARCH：ユーザー検索 */}
{mode === "search" && (
  <UserSearchScreen
    keyword={userKeyword}
    onChangeKeyword={setUserKeyword}
    searching={userSearching}
    error={userSearchError}
    results={userResults}
    onSearch={handleUserSearch}
    onSelectUser={(id) => {
      // async 関数でもここでラップしておけば OK
      void openProfile(id);
    }}
    posts={posts}
    onStartQuiz={startQuiz}
    onShare={openShare}
  />
)}


{/* NOTIFICATIONS */}
{mode === "notifications" && <NotificationsScreen />}


                {/* PROFILE */}
                {mode === "profile" && profileUserId !== null && (
                    <>
                        {profileLoading && (
                            <Card>
                                <div className="px-4 py-4 text-sm text-gray-500">
                                    プロフィールを読み込み中です…
                                </div>
                            </Card>
                        )}

                        {profileError && !profileLoading && (
                            <Card>
                                <div className="px-4 py-4 text-sm text-red-500">
                                    {profileError}
                                </div>
                            </Card>
                        )}

                        {!profileLoading && !profileError && (
                            <ProfileScreen
                                userId={profileUserId}
                                posts={profilePosts}
                                isFollowing={profileIsFollowing}
                                followingCount={profileFollowingCount}
                                followerCount={profileFollowerCount}
                                onToggleFollow={() =>
                                    toggleFollow(profileUserId)
                                }
                                onBack={() => setMode("home")}
                                onStartAnswer={(posts) => {
                                    setAnswerPool(posts);
                                    setMode("answer");
                                }}
                                // reactionStats={profileReactionStats}
                            />
                        )}
                    </>
                )}

                <div className="h-4" />
            </div>

            {/* 投稿モーダル */}
            <Modal open={composerOpen} onClose={() => setComposerOpen(false)}>
                <Composer
                    mode={composerMode}
                    initialPosts={
                        composerMode === "edit" ? editTargetPosts : null
                    }
                    onPostBundle={addPostBundle} // 新規投稿
                    onEditBundle={applyEditBundle} // 編集（単発・まとめ両方）
                    onCancel={() => setComposerOpen(false)}
                />
            </Modal>

            <VisibilityModal
  open={visibilityModal != null}
  current={visibilityModal?.current}
  isUpdating={isUpdatingVisibility}
  onChange={handleChangeVisibility}
  onClose={closeVisibilityModal}
/>


            {/* JSON 一括投入モーダル（admin専用） */}
            <Modal
                open={bulkImportOpen}
                onClose={() => setBulkImportOpen(false)}
            >
                <BulkImportDialog
                    onClose={() => setBulkImportOpen(false)}
                    onImported={handleBulkImported}
                />
            </Modal>

            {/* 共有メッセージ編集モーダル */}
<ShareDialog
  open={shareOpen}
  tag={shareTag}
  message={shareMessage}
  onChangeMessage={setShareMessage}
  onCancel={() => setShareOpen(false)}
  onConfirm={confirmShare}
/>


            {/* ★議論用モーダル */}
            <DiscussionComposer
                open={isDiscussionComposerOpen}
                onClose={() => setIsDiscussionComposerOpen(false)}
                onSubmit={handleCreateDiscussion}
            />

            <OpinionComposer
                open={isOpinionComposerOpen}
                onClose={() => setIsOpinionComposerOpen(false)}
                onSubmit={handleCreateOpinion}
            />

            {/* ▶ ホーム画面用フローティング投稿ボタン（ブルースカイ風） ◀ */}
            {mode === "home" && (
  <FabPostButton
    onClick={() => {
      setComposerMode("create");
      setEditTargetPosts(null);
      setEditFeedId(null);
      setComposerOpen(true);
    }}
  />
)}

            {mode === "discussions" && (
                <button
                    className="fixed right-4 bottom-16 rounded-full px-4 py-3 shadow-lg bg-blue-500 text-white text-sm"
                    onClick={() => setIsDiscussionComposerOpen(true)}
                >
                    議題投稿
                </button>
            )}

            {mode === "discussionDetail" && (
                <button
                    className="fixed right-4 bottom-16 rounded-full px-4 py-3 shadow-lg bg-blue-500 text-white text-sm"
                    onClick={() => setIsOpinionComposerOpen(true)}
                >
                    意見投稿
                </button>
            )}

            {/* ボトムナビ */}
            <BottomNav
                active={activeTab}
                // onHome={async () => {
                //     setMode("home");
                //     await loadQuizzesAndFeed(); // ★ ここで最新の投稿を取得
                // }}
                onHome={handleHome}
                onSearch={() => setMode("search")}
                onFolders={() => setMode("folders")}
                onDiscussions={() => {
                    setMode("discussions");
                    loadDiscussions();
                }}
                onNotify={() => setMode("notifications")}
                onProfile={() => {
                    if (!CURRENT_USER_ID) return; // 未ログインなら何もしない
                    openProfile(CURRENT_USER_ID);
                }}
            />

            {/* サイドバー（Bluesky 風） */}
<Sidebar
  open={isSidebarOpen}
  onClose={() => setSidebarOpen(false)}
  onSelectHome={() => setMode("home")}
  onSelectSearch={() => setMode("search")}
  onSelectFolders={() => setMode("folders")}
  onSelectProfile={
    CURRENT_USER_ID
      ? () => {
          openProfile(CURRENT_USER_ID);
        }
      : undefined
  }
/>


            {/* ツールパレット（右上ボタン用） */}
<ToolsPalette
  open={isToolsOpen}
  isAdmin={IS_ADMIN}
  onClose={() => setToolsOpen(false)}
  onRequestBulkImport={() => setBulkImportOpen(true)}
/>

        </div>
    );
}
