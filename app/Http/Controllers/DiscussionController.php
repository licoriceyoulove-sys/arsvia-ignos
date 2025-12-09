<?php

namespace App\Http\Controllers;

use App\Models\Discussion;
use App\Models\DiscussionTag;
use App\Models\DiscussionOpinion;
use App\Models\DiscussionVote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DiscussionController extends Controller
{
    // 議題一覧＆検索
    public function index(Request $request)
    {
        $keyword = $request->query('keyword');

        $query = Discussion::query()
            ->with(['user', 'tags'])
            ->orderByDesc('created_at');

        if ($keyword) {
            $kw = '%' . $keyword . '%';
            $query->where(function ($q) use ($kw) {
                $q->where('title', 'LIKE', $kw)
                    ->orWhere('agenda', 'LIKE', $kw)
                    ->orWhereHas('tags', function ($sub) use ($kw) {
                        $sub->where('tag', 'LIKE', $kw);
                    });
            });
        }

        $discussions = $query->limit(50)->get();

        $result = $discussions->map(function (Discussion $d) {
            return [
                'id'                  => $d->id,
                'title'               => $d->title,
                'agenda'              => $d->agenda,
                'tags'                => $d->tags->pluck('tag')->values(),
                'author_display_name' => optional($d->user)->display_name ?? null,
                'author_ignos_id'     => optional($d->user)->ignos_id ?? null,
                'created_at'          => optional($d->created_at)?->toIso8601String(),
            ];
        });

        return response()->json($result);
    }

    // ★ 議題作成：Sanctum のログインユーザーで紐付ける版
    public function store(Request $request)
    {
        // 1) Sanctum からログインユーザーを取得
        $user = $request->user();  // auth:sanctum で来るのでこちらを使う
        if (!$user) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }
        $uid = (int) $user->id;

        // 2) 入力チェック（user_id は受け取らない）
        $data = $request->validate([
            'title'  => 'required|string|max:255',
            'agenda' => 'required|string',
            'tags'   => 'array',
            'tags.*' => 'string|max:64',
        ]);

        DB::beginTransaction();
        try {
            // 3) Discussion レコードを作成
            $discussion = Discussion::create([
                'user_id' => $uid,
                'title'   => $data['title'],
                'agenda'  => $data['agenda'],
            ]);

            // 4) タグがあれば DiscussionTag に保存
            if (!empty($data['tags'])) {
                foreach ($data['tags'] as $tag) {
                    DiscussionTag::create([
                        'discussion_id' => $discussion->id,
                        'tag'           => $tag,
                    ]);
                }
            }

            DB::commit();

            // 5) レスポンス用に、投稿者情報を users テーブルから取得
            $userRow = DB::table('users')->where('id', $uid)->first();

            return response()->json([
                'id'                  => $discussion->id,
                'title'               => $discussion->title,
                'agenda'              => $discussion->agenda,
                'tags'                => collect($data['tags'] ?? []),
                'author_display_name' => $userRow->display_name ?? null,
                'author_ignos_id'     => $userRow->ignos_id ?? null,
                // created_at が null でも落ちないように optional() 経由にする
                'created_at'          => optional($discussion->created_at)?->toIso8601String(),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            // ★ ここで実際のエラーをログに出す（開発中は message も返しておくと原因特定しやすい）
            Log::error('Failed to create discussion', [
                'user_id' => $uid,
                'payload' => $data,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'error'   => 'server_error',
                'message' => $e->getMessage(),  // エラー原因が特定できたら消してOK
            ], 500);
        }
    }

    // 議題詳細（意見＋投票状況）
    public function show(Request $request, Discussion $discussion)
    {
        $viewer = $request->user();
        $viewerId = $viewer ? (int) $viewer->id : 0;

        // user, tags, opinions.user を一括ロード
        $discussion->load(['user', 'tags', 'opinions.user']);

        // 意見ID一覧
        $opinionIds = $discussion->opinions->pluck('id')->all();

        // 各意見の vote 集計
        $rawStats = DiscussionVote::query()
            ->select('opinion_id', 'vote', DB::raw('COUNT(*) as cnt'))
            ->whereIn('opinion_id', $opinionIds)
            ->groupBy('opinion_id', 'vote')
            ->get()
            ->groupBy('opinion_id');

        // ログインユーザーの投票（意見ごと）
        $myVotes = [];
        if ($viewerId > 0) {
            $myVotes = DiscussionVote::query()
                ->whereIn('opinion_id', $opinionIds)
                ->where('user_id', $viewerId)
                ->pluck('vote', 'opinion_id')
                ->toArray();
        }

        $opinions = $discussion->opinions->map(function (DiscussionOpinion $opinion) use ($rawStats, $myVotes) {
            // ★ Collection 経由で安全に取得
            $statsForOpinion = $rawStats->get($opinion->id, collect());

            $counts = [
                'agree'    => 0,
                'disagree' => 0,
                'pass'     => 0,
            ];

            foreach ($statsForOpinion as $row) {
                $vote = $row->vote;
                if (isset($counts[$vote])) {
                    $counts[$vote] = (int) $row->cnt;
                }
            }

            $total  = $counts['agree'] + $counts['disagree'] + $counts['pass'];
            $myVote = $myVotes[$opinion->id] ?? null;

            // ★仕様：投票するまで投票率は伏せる
            $visible = $myVote !== null;

            return [
                'id'                  => $opinion->id,
                'body'                => $opinion->body,
                'author_display_name' => optional($opinion->user)->display_name ?? null,
                'author_ignos_id'     => optional($opinion->user)->ignos_id ?? null,
                'created_at'          => optional($opinion->created_at)?->toIso8601String(),
                'stats'               => [
                    'visible'  => $visible,
                    'agree'    => $visible ? $counts['agree']    : 0,
                    'disagree' => $visible ? $counts['disagree'] : 0,
                    'pass'     => $visible ? $counts['pass']     : 0,
                    'total'    => $visible ? $total              : 0,
                    'my_vote'  => $myVote,
                ],
            ];
        });

        return response()->json([
            'id'                  => $discussion->id,
            'title'               => $discussion->title,
            'agenda'              => $discussion->agenda,
            'tags'                => $discussion->tags->pluck('tag')->values(),
            'author_display_name' => optional($discussion->user)->display_name ?? null,
            'author_ignos_id'     => optional($discussion->user)->ignos_id ?? null,
            'created_at'          => optional($discussion->created_at)?->toIso8601String(),
            'opinions'            => $opinions,
        ]);
    }
}
