<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| ベースURL:
|  - ローカル: http://127.0.0.1:8000/api/...
|  - 本番:     https://snowwhite.sakura.ne.jp/ignos/public/api/...
|
| このファイルのルートは自動的に "api" ミドルウェアグループが適用されます。
| → CSRF ミドルウェアは含まれないので、419 の心配はありません。
*/

/**
 * デバッグ用:
 * GET /api/__route_check
 */
Route::get('/__route_check', fn() => [
    'ok' => true,
    'file' => __FILE__,
]);

/**
 * ヘルスチェック
 * GET /api/ping
 * GET /api/db-ping
 */
Route::get('/ping', fn() => ['ok' => true]);

Route::get('/db-ping', function () {
    DB::select('SELECT 1');
    return ['db' => 'ok'];
});

/* ============================================================
   クイズ API
   - GET  /api/quizzes        : 一覧取得（users.display_name を join）
   - POST /api/quizzes/bulk   : まとめて保存（投稿）
============================================================ */

/**
 * GET /api/quizzes
 * quizzes テーブルから一覧を取得して JSON で返す
 * ついでに users.display_name を author_display_name として返す
 */
Route::get('/quizzes', function (Request $request) {
    $viewerId = (int) $request->query('viewer_id', 0);

    $query = DB::table('quizzes')
        ->leftJoin('users', 'quizzes.author_id', '=', 'users.id')
        ->select(
            'quizzes.*',
            'users.display_name as author_display_name',
            'users.ignos_id as author_ignos_id'
        );

    if ($viewerId > 0) {
        $followeeIds = DB::table('follows')
            ->where('user_id', $viewerId)
            ->pluck('target_user_id')
            ->toArray();

        $query->where(function ($q) use ($viewerId, $followeeIds) {

            // ① 自分の投稿は常に表示
            $q->where('quizzes.author_id', $viewerId);

            // ② フォロー中で visibility != 1
            if (!empty($followeeIds)) {
                $q->orWhere(function ($q2) use ($followeeIds) {
                    $q2->whereIn('quizzes.author_id', $followeeIds)
                        ->where('quizzes.visibility', '!=', 1);
                });
            }
        });
    }

    $rows = $query->orderBy('quizzes.created_at', 'desc')->get();

    $rows = $rows->map(function ($r) {
        $r->choices  = $r->choices !== null ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags !== null ? json_decode($r->hashtags, true) : [];
        return $r;
    });

    return response()->json($rows);
});



/**
 * POST /api/quizzes/bulk
 * React から送られてきたクイズ配列をまとめて保存
 * リクエストボディは JSON 配列想定
 */
Route::post('/quizzes/bulk', function (Request $request) {
    $rows = $request->json()->all();

    if (!is_array($rows)) {
        return response()->json([
            'ok' => false,
            'message' => 'JSON 配列で送信してください',
        ], 422);
    }

    DB::transaction(function () use ($rows) {
        foreach ($rows as $row) {
            $id = $row['id'] ?? (string) Str::uuid();
            $question = $row['question'] ?? '';
            $type = $row['type'] ?? 'choice';
            $choices = $row['choices'] ?? null;
            $correctIndex = $row['correct_index'] ?? null;
            $modelAnswer = $row['model_answer'] ?? null;
            $note = $row['note'] ?? null;
            $hashtags = $row['hashtags'] ?? [];
            $visibility = $row['visibility'] ?? 1;
            $authorId = $row['author_id'] ?? null;
            // created_at はフロントの値は使わず、サーバー時間に固定
            $createdAt = now();

            DB::table('quizzes')->updateOrInsert(
                ['id' => $id],
                [
                    'author_id' => $authorId,
                    'question' => $question,
                    'type' => $type,
                    'choices' => $choices !== null
                        ? json_encode($choices, JSON_UNESCAPED_UNICODE)
                        : null,
                    'correct_index' => $correctIndex,
                    'model_answer' => $modelAnswer,
                    'note' => $note,
                    'hashtags' => json_encode($hashtags, JSON_UNESCAPED_UNICODE),
                    'visibility' => $visibility,
                    'created_at' => $createdAt,
                ]
            );
        }
    });

    return response()->json(['ok' => true]);
})->withoutMiddleware(\App\Http\Middleware\VerifyCsrfToken::class);

/* ============================================================
   フィード API
   - POST   /api/feed       : フィード1件保存
   - PATCH  /api/feed/{id}  : likes / retweets / answers を +1
============================================================ */

/**
 * POST /api/feed
 */
Route::post('/feed', function (Request $request) {
    $body = $request->json()->all();

    $id = $body['id'] ?? (string) Str::uuid();
    $kind = $body['kind'] ?? 'quiz';
    $data = $body['data'] ?? [];
    $likes = $body['likes'] ?? 0;
    $retweets = $body['retweets'] ?? 0;
    $answers = $body['answers'] ?? 0;
    $authorId  = $body['author_id']  ?? null;
    $createdAt = now();

    DB::table('feed_items')->updateOrInsert(
        ['id' => $id],
        [
            'kind' => $kind,
            'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'likes' => $likes,
            'retweets' => $retweets,
            'answers' => $answers,
            'created_at' => $createdAt,
            'author_id' => $authorId,
        ]
    );

    return response()->json(['ok' => true]);
});

/**
 * PATCH /api/feed/{id}
 * body: { field: "likes" | "retweets" | "answers" }
 */
Route::patch('/feed/{id}', function (Request $request, string $id) {
    $field = $request->input('field');

    if (!in_array($field, ['likes', 'retweets', 'answers'], true)) {
        return response()->json([
            'ok' => false,
            'message' => 'field は likes / retweets / answers のいずれかです',
        ], 422);
    }

    DB::table('feed_items')
        ->where('id', $id)
        ->update([
            $field => DB::raw("$field + 1"),
        ]);

    return response()->json(['ok' => true]);
});

/* ============================================================
   フォロー情報 API
   - GET /api/follows  : viewer_id がフォローしているユーザーID一覧
============================================================ */

Route::get('/follows', function (Request $request) {
    // クエリパラメータ ?viewer_id=1 を想定
    $viewerId = $request->query('viewer_id');

    if (empty($viewerId)) {
        return response()->json([
            'ids' => [],
        ]);
    }

    // follows テーブルから「viewerId がフォローしているユーザーID」を取得
    // user_id        = フォローする側（自分）
    // target_user_id = フォローされる側（相手）
    $ids = DB::table('follows')
        ->where('user_id', $viewerId)
        ->pluck('target_user_id')
        ->values()   // 0,1,2,... に詰め直し
        ->all();

    return response()->json([
        'ids' => $ids,   // 例: [2, 5, 10]
    ]);
});
