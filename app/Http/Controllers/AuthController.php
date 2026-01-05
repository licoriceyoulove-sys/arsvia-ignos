<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Models\User; // ★ 追加：Sanctumトークン発行に必要

class AuthController extends Controller
{
    /**
     * GET /login
     * ログイン画面を表示（ログイン済みなら /home へ）
     */
    public function showLogin(Request $request)
    {
        // ★ Laravel 認証でログイン済みなら /home へ
        if (Auth::check()) {
            return redirect('/home');
        }

        // 旧セッション方式も一応残しておくなら:
        // if ($request->session()->has('uid')) {
        //     return redirect('/home');
        // }

        return view('login'); // resources/views/login.blade.php
    }

    /**
     * POST /login
     * ID/パスワードをDBと照合してホームへ遷移
     */
    // public function doLogin(Request $request)
    // {
    //     // 入力バリデーション
    //     $data = $request->validate([
    //         'login_id' => ['required', 'string', 'max:64'],
    //         'password' => ['required', 'string', 'max:200'],
    //     ]);

    //     // users テーブルから login_id で1件取得（旧実装と同じ）
    //     $row = DB::table('users')->where('login_id', $data['login_id'])->first();

    //     $fail = fn () =>
    //         back()->withErrors(['auth' => 'IDまたはパスワードが正しくありません'])
    //              ->withInput();

    //     if (!$row) {
    //         return $fail();
    //     }

    //     // password_hash カラムと照合
    //     if (!password_verify($data['password'], $row->password_hash)) {
    //         return $fail();
    //     }

    //     // ★ Laravel 認証にもログイン
    //     Auth::loginUsingId($row->id);

    //     // ★ Sanctum トークン発行 → セッションに保存
    //     $userModel = User::find($row->id);
    //     if ($userModel) {
    //         // 必要なら既存トークンを消してもOK（コメントアウト例）
    //         // $userModel->tokens()->delete();

    //         $plainToken = $userModel->createToken('ignos-session-token')->plainTextToken;

    //         // 後で Blade から window.Ignos.apiToken として渡すためにセッションへ
    //         $request->session()->put('api_token', $plainToken);
    //     }

    //     // 旧実装と同じ：セッションにユーザー情報を保存（互換性維持）
    //     $request->session()->put('uid', $row->id);
    //     $request->session()->put('name', $row->name ?? '');
    //     $request->session()->put('account_level', $row->account_level ?? 2);

    //     // セッションID再発行（セキュリティ対策）
    //     $request->session()->regenerate();

    //     return redirect('/home');
    // }
public function doLogin(Request $request)
{
    $data = $request->validate([
        'login_id' => ['required', 'string', 'max:64'],
        'password' => ['required', 'string', 'max:200'],
    ]);

    $user = DB::table('users')->where('login_id', $data['login_id'])->first();

    $fail = fn () =>
        back()->withErrors(['auth' => 'IDまたはパスワードが正しくありません'])
             ->withInput();

    if (!$user) return $fail();
    if (!password_verify($data['password'], $user->password_hash)) return $fail();

    // ✅ セッションログイン
    Auth::loginUsingId($user->id);

    // ✅ セッション固定攻撃対策（ログイン後に再発行）
    $request->session()->regenerate();

    return redirect('/home');
}


    /**
     * POST /logout
     * セッションを破棄してログイン画面に戻る
     */
    public function logout(Request $request)
    {
        // ★ セッションからトークン文字列は消しておく（DB上のトークンは任意）
        $request->session()->forget('api_token');

        // ★ もし「ログアウト時にトークンも全削除したい」なら以下を追加しても良い
        // if ($user = Auth::user()) {
        //     $user->tokens()->delete();
        // }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
