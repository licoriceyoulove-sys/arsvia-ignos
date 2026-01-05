<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

use App\Http\Controllers\Api\AuthApiController;

/*
|--------------------------------------------------------------------------
| API Routes (Token / External API 専用)
|--------------------------------------------------------------------------
| ここは「外部クライアント・将来のモバイルアプリ」向け。
| 自社Web（Blade + React）から使う Feed / Quiz API は
| routes/web.php 側で「web + auth + CSRF」で受ける。
|
| 👉 Twitterでいう「OAuth API」に相当する場所
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| 認証（トークン）
|--------------------------------------------------------------------------
*/

// トークンログイン（外部アプリ用）
Route::post('/login-token', [AuthApiController::class, 'login']);

// トークンログアウト
Route::post('/logout-token', [AuthApiController::class, 'logout'])
    ->middleware('auth:sanctum');

// トークンでのログイン確認
Route::get('/me', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


/*
|--------------------------------------------------------------------------
| デバッグ / ヘルスチェック
|--------------------------------------------------------------------------
*/

Route::get('/__route_check', fn () => [
    'ok'   => true,
    'file' => __FILE__,
]);

Route::get('/ping', fn () => ['ok' => true]);

Route::get('/db-ping', function () {
    DB::select('SELECT 1');
    return ['db' => 'ok'];
});


/*
|--------------------------------------------------------------------------
| 機能別 API（※ Feed は含めない）
|--------------------------------------------------------------------------
| これらは「将来トークンAPI化しても破綻しないもの」だけを置く
|--------------------------------------------------------------------------
*/

require __DIR__ . '/api/quizzes.php';
require __DIR__ . '/api/follows.php';
require __DIR__ . '/api/users.php';
require __DIR__ . '/api/categories.php';

// 将来用（今は空でもOK）
require __DIR__ . '/api/reactions.php';

/*
|--------------------------------------------------------------------------
| ❌ 注意
|--------------------------------------------------------------------------
| Feed API はここに置かない
| → routes/web.php 側で
|    Route::middleware(['web','auth'])->prefix('api')...
|    として受ける（セッション方式）
|--------------------------------------------------------------------------
*/
