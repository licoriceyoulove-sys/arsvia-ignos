<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Http\Controllers\DiscussionController;
use App\Http\Controllers\DiscussionOpinionController;
use App\Http\Controllers\DiscussionVoteController;
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
 * POST /api/quizzes/bulk-delete
 * body: { ids: string[] }
 * まとめてクイズを削除する
 */
Route::post('/quizzes/bulk-delete', function (Request $request) {
    $ids = $request->input('ids', []);

    if (!is_array($ids) || empty($ids)) {
        return response()->json([
            'ok'      => false,
            'message' => 'ids は配列で指定してください',
        ], 422);
    }

    // 必要ならここでバリデーション（文字列配列か？など）
    $ids = array_filter($ids, fn($v) => is_string($v) && $v !== '');

    if (empty($ids)) {
        return response()->json([
            'ok'      => false,
            'message' => '有効な id がありません',
        ], 422);
    }

    // ★ 現状の設計に合わせて、所有者チェックなしで単純削除
    // （認証を入れる場合はここに where('author_id', $userId) などを足す）
    $deleted = DB::table('quizzes')
        ->whereIn('id', $ids)
        ->delete();

    return response()->json([
        'ok'      => true,
        'deleted' => $deleted,
    ]);
})->withoutMiddleware(\App\Http\Middleware\VerifyCsrfToken::class);

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
            $id           = $row['id'] ?? (string) Str::uuid();
            $question     = $row['question'] ?? '';
            $type         = $row['type'] ?? 'choice';
            $choices      = $row['choices'] ?? null;
            $correctIndex = $row['correct_index'] ?? null;
            $modelAnswer  = $row['model_answer'] ?? null;
            $note         = $row['note'] ?? null;
            $hashtags     = $row['hashtags'] ?? [];
            $visibility   = $row['visibility'] ?? 1;
            $authorId     = $row['author_id'] ?? null;

            // ★ ここを追加：フロントから送られてくる bundle_id / bundle_order を拾う
            $bundleId     = $row['bundle_id'] ?? null;
            $bundleOrder  = $row['bundle_order'] ?? 0;

            // created_at はフロントの値は使わず、サーバー時間に固定
            $createdAt = now();

            DB::table('quizzes')->updateOrInsert(
                ['id' => $id],
                [
                    'author_id'     => $authorId,
                    'question'      => $question,
                    'type'          => $type,
                    'choices'       => $choices !== null
                        ? json_encode($choices, JSON_UNESCAPED_UNICODE)
                        : null,
                    'correct_index' => $correctIndex,
                    'model_answer'  => $modelAnswer,
                    'note'          => $note,
                    'hashtags'      => json_encode($hashtags, JSON_UNESCAPED_UNICODE),
                    'visibility'    => $visibility,
                    'created_at'    => $createdAt,

                    // ★ ここも追加：DBのカラムに保存
                    'bundle_id'     => $bundleId,
                    'bundle_order'  => $bundleOrder,
                ]
            );
        }
    });

    return response()->json(['ok' => true]);
})->withoutMiddleware(\App\Http\Middleware\VerifyCsrfToken::class);


// ★ 追加: 指定ユーザーの投稿一覧（プロフィール用）
Route::get('/users/{id}/quizzes', function (int $id) {
    $rows = DB::table('quizzes')
        ->leftJoin('users', 'quizzes.author_id', '=', 'users.id')
        ->select(
            'quizzes.*',
            'users.display_name as author_display_name',
            'users.ignos_id as author_ignos_id'
        )
        ->where('quizzes.author_id', $id)
        ->orderBy('quizzes.created_at', 'desc')
        ->get();

    $rows = $rows->map(function ($r) {
        $r->choices  = $r->choices !== null ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags !== null ? json_decode($r->hashtags, true) : [];
        return $r;
    });

    return response()->json($rows);
});

// タグ検索用
Route::get('/quizzes/global', function (Request $request) {
    // visibility = 3（グローバル）のみ
    $rows = DB::table('quizzes as q')
        ->leftJoin('users as u', 'u.id', '=', 'q.author_id')
        ->select([
            'q.id',
            'q.question',
            'q.type',
            'q.choices',
            'q.correct_index',
            'q.model_answer',
            'q.note',
            'q.hashtags',
            'q.created_at',
            'q.author_id',
            'q.visibility',
            'q.category_tag',
            'q.bundle_id',
            'q.bundle_order',
            // プロフィール表示用
            'u.display_name as author_display_name',
            'u.ignos_id as author_ignos_id',
        ])
        ->where('q.visibility', 3)
        ->orderByDesc('q.created_at')
        ->limit(1000) // 必要に応じて調整
        ->get();

    // /api/quizzes と同じように JSON を decode
    $rows->transform(function ($r) {
        $r->choices = $r->choices ? json_decode($r->choices, true) : null;
        $r->hashtags = $r->hashtags ? json_decode($r->hashtags, true) : [];
        // created_at はそのまま返して OK（フロントで fromQuizRow が処理）
        return $r;
    });

    return response()->json($rows);
});

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

Route::post('/follows/toggle', function (Request $request) {
    $userId   = (int) $request->input('user_id');
    $targetId = (int) $request->input('target_user_id');

    if ($userId <= 0 || $targetId <= 0) {
        return response()->json([
            'ok' => false,
            'message' => 'user_id と target_user_id は必須です',
        ], 422);
    }

    if ($userId === $targetId) {
        return response()->json([
            'ok' => false,
            'message' => '自分自身はフォローできません',
        ], 400);
    }

    // 既にフォローしているか？
    $exists = DB::table('follows')
        ->where('user_id', $userId)
        ->where('target_user_id', $targetId)
        ->exists();

    if ($exists) {
        // すでにフォローしている → 解除
        DB::table('follows')
            ->where('user_id', $userId)
            ->where('target_user_id', $targetId)
            ->delete();

        return response()->json([
            'ok' => true,
            'following' => false, // 解除された
        ]);
    } else {
        // まだフォローしていない → 新規フォロー
        $now = now();
        DB::table('follows')->insert([
            'user_id'        => $userId,
            'target_user_id' => $targetId,
            // 'created_at'     => $now,
            // 'updated_at'     => $now,
        ]);

        return response()->json([
            'ok' => true,
            'following' => true, // フォローされた
        ]);
    }
});
/* ============================================================
   ユーザー検索 API
   - GET /api/users/search?q=キーワード
   - 対象: users.display_name / users.ignos_id の部分一致
============================================================ */

Route::get('/users/search', function (Request $request) {
    $q = trim((string) $request->query('q', ''));

    if ($q === '') {
        return response()->json([
            'users' => [],
        ]);
    }

    $users = DB::table('users')
        ->select('id', 'display_name', 'ignos_id')
        ->where(function ($query) use ($q) {
            $like = '%' . $q . '%';
            $query->where('display_name', 'LIKE', $like)
                  ->orWhere('ignos_id', 'LIKE', $like);
        })
        ->orderBy('id')
        ->limit(50)
        ->get();

    return response()->json([
        'users' => $users,
    ]);
});

// ★ プロフィール用フォローカウント + フォロー状態API
Route::get('/users/{id}/follow-stats', function (Request $request, int $id) {

    // プロフィールを見ている人（ログイン中ユーザー）※未ログインなら 0
    $viewerId = (int) $request->query('viewer_id', 0);

    // フォロー数（このユーザーがフォローしている人数）
    $followingCount = DB::table('follows')
        ->where('user_id', $id)
        ->count();

    // フォロワー数（このユーザーをフォローしている人数）
    $followerCount = DB::table('follows')
        ->where('target_user_id', $id)
        ->count();

    // viewer がこのユーザーをフォローしているか？
    $isFollowing = false;
    if ($viewerId > 0) {
        $isFollowing = DB::table('follows')
            ->where('user_id', $viewerId)
            ->where('target_user_id', $id)
            ->exists();
    }

    return response()->json([
        'user_id'          => $id,
        'following_count'  => $followingCount,
        'follower_count'   => $followerCount,
        'is_following'     => $isFollowing,
    ]);
});

/**
 * 大カテゴリ一覧取得
 * GET /api/category-larges
 */
Route::get('/category-larges', function () {
    try {
        // ★ まずは余計な where / orderBy は付けずに、テーブルから全件取得だけやってみる
        $larges = DB::table('category_larges')   // ← テーブル名が本当にこれか要確認（後述）
            ->select('id', 'name_jp', 'name_en', 'description')
            ->get();

        return response()->json($larges);
    } catch (\Throwable $e) {
        // デバッグ用：エラー内容をログに出して、簡単なメッセージを返す
        \Log::error('GET /api/category-larges failed', [
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'ok' => false,
            'message' => 'category_larges query failed',
        ], 500);
    }
});

/**
 * 中カテゴリ一覧取得
 * GET /api/category-middles
 */
Route::get('/category-middles', function () {
    try {
        $middles = DB::table('category_middles')
            ->where('is_active', 1)       // 有効なものだけ
            ->whereNull('deleted_at')      // 論理削除されていないものだけ
            ->select(
                'id',
                'large_id',
                'code',
                'name_jp',
                'name_en',
                'description'
            )
            ->orderBy('large_id')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json($middles);
    } catch (\Throwable $e) {
        \Log::error('GET /api/category-middles failed', [
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'ok'      => false,
            'message' => 'category_middles query failed',
        ], 500);
    }
});

/**
 * 小カテゴリ一覧取得
 * GET /api/category-smalls
 */
Route::get('/category-smalls', function () {
    try {
        $smalls = DB::table('category_smalls')
            ->where('is_active', 1)        // 有効のみ
            ->whereNull('deleted_at')      // 論理削除されていないもの
            ->select(
                'id',
                'middle_id',               // ★ 中カテゴリID
                'code',
                'name_jp',
                'name_en',
                'description'
            )
            ->orderBy('middle_id')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json($smalls);
    } catch (\Throwable $e) {
        \Log::error('GET /api/category-smalls failed', [
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'ok'      => false,
            'message' => 'category_smalls query failed',
        ], 500);
    }
});

// 認証が必要なら ->middleware('auth') を適宜追加
Route::middleware('auth')->group(function () {
    // 議題一覧＆検索
    Route::get('/discussions', [DiscussionController::class, 'index']);

    // 議題作成
    Route::post('/discussions', [DiscussionController::class, 'store']);

    // 議題詳細（意見＋投票状況）
    Route::get('/discussions/{discussion}', [DiscussionController::class, 'show']);

    // 意見投稿
    Route::post('/discussions/{discussion}/opinions', [DiscussionOpinionController::class, 'store']);

    // 投票（賛成/反対/パス）
    Route::post('/discussions/opinions/{opinion}/vote', [DiscussionVoteController::class, 'store']);
});

/**
 * POST /api/quizzes/{id}/visibility
 * body: { visibility: 1|2|3, user_id?: number }
 * 指定クイズの公開範囲を変更する
 */
Route::post('/quizzes/{id}/visibility', function (Request $request, string $id) {
    $visibility = (int) $request->input('visibility', 0);
    $userId     = (int) $request->input('user_id', 0); // 任意（将来 author チェックしたい時用）

    // 値チェック
    if (!in_array($visibility, [1, 2, 3], true)) {
        return response()->json([
            'ok'      => false,
            'message' => 'visibility は 1(自分のみ) / 2(フォロワー限定) / 3(グローバル) のいずれかです',
        ], 422);
    }

    // ここで「自分の投稿だけ変更可」にしたい場合
    // user_id が送られていなければとりあえず author チェックなしで更新
    $query = DB::table('quizzes')->where('id', $id);

    if ($userId > 0) {
        // 将来的な安全のため：author_id が自分のものだけ更新
        $query->where('author_id', $userId);
    }

    $updated = $query->update(['visibility' => $visibility]);

    if ($updated === 0) {
        // id が存在しない or 自分の投稿ではない
        return response()->json([
            'ok'      => false,
            'message' => '対象のクイズが見つからないか、更新権限がありません',
        ], 404);
    }

    return response()->json([
        'ok'         => true,
        'visibility' => $visibility,
    ]);
})->withoutMiddleware(VerifyCsrfToken::class);