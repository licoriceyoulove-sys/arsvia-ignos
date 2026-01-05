<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;

// bulk-delete
Route::post('/quizzes/bulk-delete', function (Request $request) {
    $ids = $request->input('ids', []);

    if (!is_array($ids) || empty($ids)) {
        return response()->json([
            'ok'      => false,
            'message' => 'ids は配列で指定してください',
        ], 422);
    }

    $ids = array_filter($ids, fn($v) => is_string($v) && $v !== '');
    if (empty($ids)) {
        return response()->json([
            'ok'      => false,
            'message' => '有効な id がありません',
        ], 422);
    }

    $deleted = DB::table('quizzes')->whereIn('id', $ids)->delete();

    return response()->json([
        'ok'      => true,
        'deleted' => $deleted,
    ]);
})->withoutMiddleware(\App\Http\Middleware\VerifyCsrfToken::class);

// GET /quizzes（webミドルウェアでセッションAuthを使う版）
Route::middleware('web')->get('/quizzes', function (Request $request) {
    $viewerId = Auth::id();
    if (!$viewerId) return response()->json([]);

    $query = DB::table('quizzes')
        ->leftJoin('users', 'quizzes.author_id', '=', 'users.id')
        ->select(
            'quizzes.*',
            'users.display_name as author_display_name',
            'users.ignos_id as author_ignos_id'
        );

    $followeeIds = DB::table('follows')
        ->where('user_id', $viewerId)
        ->pluck('target_user_id')
        ->toArray();

    $query->where(function ($q) use ($viewerId, $followeeIds) {
        $q->where('quizzes.author_id', $viewerId);

        if (!empty($followeeIds)) {
            $q->orWhere(function ($q2) use ($followeeIds) {
                $q2->whereIn('quizzes.author_id', $followeeIds)
                   ->where('quizzes.visibility', '!=', 1);
            });
        }
    });

    $rows = $query->orderBy('quizzes.created_at', 'desc')->get();

    $rows = $rows->map(function ($r) {
        $r->choices  = $r->choices !== null ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags !== null ? json_decode($r->hashtags, true) : [];
        return $r;
    });

    return response()->json($rows);
});

// POST /quizzes/bulk（sanctum）
Route::middleware(['auth:sanctum'])->post('/quizzes/bulk', function (Request $request) {
    $rows = $request->json()->all();
    if (!is_array($rows)) {
        return response()->json([
            'ok' => false,
            'message' => 'JSON 配列で送信してください',
        ], 422);
    }

    $authorId = Auth::id();
    if (!$authorId) {
        return response()->json([
            'ok' => false,
            'message' => 'ログインが必要です',
        ], 401);
    }

    DB::transaction(function () use ($rows, $authorId) {
        foreach ($rows as $row) {
            $id           = $row['id'] ?? (string) Str::uuid();
            $question     = $row['question'] ?? '';
            $type         = $row['type'] ?? 'choice';
            $choices      = $row['choices'] ?? null;
            $correctIndex = $row['correct_index'] ?? null;
            $modelAnswer  = $row['model_answer'] ?? null;
            $note         = $row['note'] ?? null;
            $hashtags     = $row['hashtags'] ?? [];
            $visibility   = $row['visibility'] ?? 1;

            $bundleId     = $row['bundle_id'] ?? null;
            $bundleOrder  = $row['bundle_order'] ?? 0;

            DB::table('quizzes')->updateOrInsert(
                ['id' => $id],
                [
                    'author_id'     => $authorId,
                    'question'      => $question,
                    'type'          => $type,
                    'choices'       => $choices !== null ? json_encode($choices, JSON_UNESCAPED_UNICODE) : null,
                    'correct_index' => $correctIndex,
                    'model_answer'  => $modelAnswer,
                    'note'          => $note,
                    'hashtags'      => json_encode($hashtags, JSON_UNESCAPED_UNICODE),
                    'visibility'    => $visibility,
                    'created_at'    => now(),
                    'bundle_id'     => $bundleId,
                    'bundle_order'  => $bundleOrder,
                ]
            );
        }
    });

    return response()->json(['ok' => true]);
});

// グローバル
Route::get('/quizzes/global', function () {
    $rows = DB::table('quizzes as q')
        ->leftJoin('users as u', 'u.id', '=', 'q.author_id')
        ->select([
            'q.id','q.question','q.type','q.choices','q.correct_index','q.model_answer','q.note','q.hashtags',
            'q.created_at','q.author_id','q.visibility','q.category_tag','q.bundle_id','q.bundle_order',
            'u.display_name as author_display_name','u.ignos_id as author_ignos_id',
        ])
        ->where('q.visibility', 3)
        ->orderByDesc('q.created_at')
        ->limit(1000)
        ->get();

    $rows->transform(function ($r) {
        $r->choices = $r->choices ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags ? json_decode($r->hashtags, true) : [];
        return $r;
    });

    return response()->json($rows);
});

// visibility
Route::middleware(['auth:sanctum'])->post('/quizzes/{id}/visibility', function (Request $request, string $id) {
    $visibility = (int) $request->input('visibility', 0);
    $userId     = Auth::id() ?? 0;

    if (!in_array($visibility, [1, 2, 3], true)) {
        return response()->json([
            'ok'      => false,
            'message' => 'visibility は 1/2/3 のいずれかです',
        ], 422);
    }

    $query = DB::table('quizzes')->where('id', $id);
    if ($userId > 0) $query->where('author_id', $userId);

    $updated = $query->update(['visibility' => $visibility]);

    if ($updated === 0) {
        return response()->json([
            'ok'      => false,
            'message' => '対象が見つからないか、更新権限がありません',
        ], 404);
    }

    return response()->json(['ok' => true, 'visibility' => $visibility]);
});
