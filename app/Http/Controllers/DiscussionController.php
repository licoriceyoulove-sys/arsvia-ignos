<?php

namespace App\Http\Controllers;

use App\Models\Discussion;
use App\Models\DiscussionOpinion;
use App\Models\DiscussionTag;
use App\Models\DiscussionVote;
// use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
                'created_at'          => $d->created_at->toIso8601String(),
            ];
        });

        return response()->json($result);
    }

    // 議題作成：ログイン中ユーザー（session('uid')）で紐付ける
    public function store(Request $request)
    {
        // ★ 1) セッションからログイン中ユーザーIDを取得
        $uid = $request->session()->get('uid');

        // ログインしてなければ 401 を返す
        if (!$uid) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // ★ 2) 入力チェック（user_id はもう受け取らない）
        $data = $request->validate([
            'title'  => 'required|string|max:255',
            'agenda' => 'required|string',
            'tags'   => 'array',
            'tags.*' => 'string|max:64',
        ]);

        DB::beginTransaction();
        try {
            // ★ 3) Discussion レコードを作成
            $discussion = Discussion::create([
                'user_id' => $uid,              // ← ここが「誰の投稿か」
                'title'   => $data['title'],
                'agenda'  => $data['agenda'],
            ]);

            // ★ 4) タグがあれば DiscussionTag に保存
            if (!empty($data['tags'])) {
                foreach ($data['tags'] as $tag) {
                    DiscussionTag::create([
                        'discussion_id' => $discussion->id,
                        'tag'           => $tag,
                    ]);
                }
            }

            DB::commit();

            // ★ 5) レスポンス用に、投稿者情報を users テーブルから取得
            $user = DB::table('users')->where('id', $uid)->first();

            return response()->json([
                'id'                  => $discussion->id,
                'title'               => $discussion->title,
                'agenda'              => $discussion->agenda,
                'tags'                => collect($data['tags'] ?? []),
                'author_display_name' => $user->display_name ?? null,
                'author_ignos_id'     => $user->ignos_id ?? null,
                'created_at'          => $discussion->created_at->toIso8601String(),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['error' => 'failed_to_create_discussion'], 500);
        }
    }

    // 議題詳細（意見＋投票状況）
    public function show(Request $request, Discussion $discussion)
    {
        // ★ ログインユーザーIDはクエリ ?viewer_id=1 で受け取る
        $viewerId = (int) $request->query('viewer_id', 0);

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
        if ($viewerId) {
            $myVotes = DiscussionVote::query()
                ->whereIn('opinion_id', $opinionIds)
                ->where('user_id', $viewerId)
                ->pluck('vote', 'opinion_id')
                ->toArray();
        }

        $opinions = $discussion->opinions->map(function (DiscussionOpinion $opinion) use ($rawStats, $myVotes) {
            $statsForOpinion = $rawStats[$opinion->id] ?? collect();

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

            $total = $counts['agree'] + $counts['disagree'] + $counts['pass'];

            $myVote = $myVotes[$opinion->id] ?? null;

            // ★仕様：投票するまで投票率は伏せる
            $visible = $myVote !== null;

            return [
                'id'                  => $opinion->id,
                'body'                => $opinion->body,
                'author_display_name' => optional($opinion->user)->display_name ?? null,
                'author_ignos_id'     => optional($opinion->user)->ignos_id ?? null,
                'created_at'          => $opinion->created_at->toIso8601String(),
                'stats'               => [
                    'visible'  => $visible,
                    'agree'    => $visible ? $counts['agree'] : 0,
                    'disagree' => $visible ? $counts['disagree'] : 0,
                    'pass'     => $visible ? $counts['pass'] : 0,
                    'total'    => $visible ? $total : 0,
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
            'created_at'          => $discussion->created_at->toIso8601String(),
            'opinions'            => $opinions,
        ]);
    }
}
