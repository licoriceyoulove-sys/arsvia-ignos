<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\AuthController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| 画面表示用（Blade + React エントリなど）
| ここは "web" ミドルウェアグループが自動で付きます（CSRF あり）
*/

// ログイン画面表示
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');

// ログイン実行（フォームから POST）
Route::post('/login', [AuthController::class, 'doLogin']);

// ログアウト
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// ホーム画面（未ログインなら /login へ）
Route::get('/home', function () {
    // セッションに uid がなければログインへリダイレクト
    if (!session()->has('uid')) {
        return redirect()->route('login');
    }

    $uid = session('uid');

    // ログイン中ユーザーを users テーブルから取得
    // ignos_id や display_name を Blade から参照できるようにする
    $user = DB::table('users')->where('id', $uid)->first();

    return view('home', [
        'name' => session('name'),
        'user' => $user,           // ← これを Blade で使う（$user->ignos_id など）
    ]);
});

// ルート（/）に来たら /login へ飛ばす
Route::get('/', function () {
    return redirect()->route('login');
});

// フォロー一覧 API
Route::get('/api/follows', function () {
    $uid = session('uid'); // ログインユーザーID

    if (!$uid) {
        return response()->json([
            'authed'  => false,
            'follows' => [],
        ]);
    }

    // follows.user_id = 自分 の行から target_user_id を取得
    $targets = DB::table('follows')
        ->where('user_id', $uid)
        ->pluck('target_user_id')
        ->all();

    return response()->json([
        'authed'  => true,
        'user_id' => $uid,
        'follows' => $targets, // [2, 5, 10, ...] みたいな配列
    ]);
});
