<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FeedController extends Controller
{
    public function index(Request $request)
    {
        $viewerId = Auth::id();
        if (!$viewerId) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $followeeIds = DB::table('follows')
            ->where('user_id', $viewerId)
            ->pluck('target_user_id')
            ->toArray();

        $rows = DB::table('feed_items as f')
            ->where(function ($q) use ($viewerId, $followeeIds) {
                $q->where('f.author_id', $viewerId);
                if (!empty($followeeIds)) $q->orWhereIn('f.author_id', $followeeIds);
            })
            ->orderByDesc('f.created_at')
            ->get([
                'f.id','f.kind','f.data','f.created_at',
                'f.likes','f.retweets','f.answers','f.author_id',
            ]);

        return response()->json($rows->map(function ($r) {
            return [
                'id'        => (string) $r->id,
                'kind'      => (string) $r->kind,
                'data'      => json_decode($r->data, true) ?: [],
                'createdAt' => $r->created_at,
                'likes'     => (int) $r->likes,
                'retweets'  => (int) $r->retweets,
                'answers'   => (int) $r->answers,
                'author_id' => (int) $r->author_id,
            ];
        }));
    }

    public function store(Request $request)
    {
        $authorId = Auth::id();
        if (!$authorId) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $body = $request->json()->all();
        $kind = $body['kind'] ?? 'quiz';
        $data = $body['data'] ?? [];

        // quizBundle の場合は id を bundle_<bundleId> に固定
        $fixedId = null;
        if ($kind === 'quizBundle') {
            $bundleId = null;
            if (is_array($data) && isset($data[0]) && is_array($data[0])) {
                $bundleId = $data[0]['bundleId'] ?? ($data[0]['bundle_id'] ?? null);
            }
            if ($bundleId) $fixedId = 'bundle_' . $bundleId;
        }

        $id = $fixedId ?? ($body['id'] ?? (string) Str::uuid());

        // ★ 重要：既存があるなら likes/retweets/created_at を潰さない
        $exists = DB::table('feed_items')->where('id', $id)->exists();

        if ($exists) {
            DB::table('feed_items')->where('id', $id)->update([
                'kind'      => $kind,
                'data'      => json_encode($data, JSON_UNESCAPED_UNICODE),
                // created_at は維持（並び順が壊れない）
                // likes/retweets/answers も維持
            ]);
        } else {
            DB::table('feed_items')->insert([
                'id'         => $id,
                'kind'       => $kind,
                'data'       => json_encode($data, JSON_UNESCAPED_UNICODE),
                'likes'      => 0,
                'retweets'   => 0,
                'answers'    => (int) ($body['answers'] ?? 0),
                'created_at' => now(),
                'author_id'  => $authorId,
            ]);
        }

        return response()->json(['ok' => true, 'id' => $id]);
    }

    public function patch(Request $request, string $id)
    {
        $viewerId = Auth::id();
        if (!$viewerId) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $field = $request->input('field');
        if (!in_array($field, ['likes','retweets','answers'], true)) {
            return response()->json(['error' => 'invalid field'], 400);
        }

        // ★ answers も「無ければ作る」(増えない問題の対策)
        if ($field === 'answers') {
            if (!DB::table('feed_items')->where('id', $id)->exists()) {
                DB::table('feed_items')->insert([
                    'id'         => $id,
                    'kind'       => 'quiz',
                    'data'       => json_encode([], JSON_UNESCAPED_UNICODE),
                    'likes'      => 0,
                    'retweets'   => 0,
                    'answers'    => 0,
                    'created_at' => now(),
                    'author_id'  => (int) $viewerId,
                ]);
            }

            DB::table('feed_items')->where('id', $id)->increment('answers', 1);
            $answers = DB::table('feed_items')->where('id', $id)->value('answers') ?? 0;

            return response()->json(['ok' => true, 'answers' => (int) $answers]);
        }

        $reactionKind  = $field === 'likes' ? 'like' : 'retweet';
        $counterColumn = $field; // likes or retweets

        if (!DB::table('feed_items')->where('id', $id)->exists()) {
            $authorFromQuiz = null;
            $kindGuess = 'quiz';

            if (Str::startsWith($id, 'bundle_')) {
                $kindGuess = 'quizBundle';
                $bundleId = Str::after($id, 'bundle_');
                $authorFromQuiz = DB::table('quizzes')->where('bundle_id', $bundleId)->value('author_id');
            } else {
                $authorFromQuiz = DB::table('quizzes')->where('id', $id)->value('author_id');
            }

            DB::table('feed_items')->insert([
                'id'         => $id,
                'kind'       => $kindGuess,
                'data'       => json_encode([], JSON_UNESCAPED_UNICODE),
                'likes'      => 0,
                'retweets'   => 0,
                'answers'    => 0,
                'created_at' => now(),
                'author_id'  => $authorFromQuiz ? (int)$authorFromQuiz : (int)$viewerId,
            ]);
        }

        DB::beginTransaction();
        try {
            $existing = DB::table('reactions')
                ->where('user_id', $viewerId)
                ->where('feed_id', $id)
                ->where('kind', $reactionKind)
                ->first();

            if ($existing) {
                DB::table('reactions')
                    ->where('user_id', $viewerId)
                    ->where('feed_id', $id)
                    ->where('kind', $reactionKind)
                    ->delete();

                DB::table('feed_items')
                    ->where('id', $id)
                    ->update([
                        $counterColumn => DB::raw("GREATEST($counterColumn - 1, 0)")
                    ]);

                $reacted = false;
            } else {
                DB::table('reactions')->insert([
                    'user_id'    => $viewerId,
                    'feed_id'    => $id,
                    'kind'       => $reactionKind,
                    'created_at' => now(),
                ]);

                DB::table('feed_items')->where('id', $id)->increment($counterColumn, 1);

                $reacted = true;
            }

            $row = DB::table('feed_items')->where('id', $id)->first(['likes','retweets']);
            DB::commit();

            return response()->json([
                'ok'       => true,
                'reacted'  => $reacted,
                'likes'    => (int) ($row->likes ?? 0),
                'retweets' => (int) ($row->retweets ?? 0),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            \Log::error('PATCH /api/feed failed', ['feed_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'server_error'], 500);
        }
    }
}
